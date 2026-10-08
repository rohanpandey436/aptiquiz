import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import * as store from "./store.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RTT_CAP_MS = 400;
const GRACE_MS = 60;
const ALL_ANSWERED_DELAY_MS = 900;
export const BASE_POINTS = 500;
export const BONUS_POINTS = 500;
export const EXAM_PENALTY = 250;
const MAX_PLAYERS = 60;
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;

function token(bytes = 18) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function shuffle(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function round1(x) {
  return Math.round(x * 10) / 10;
}

export class GameManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.bySocket = new Map();
    this.sweepTimer = setInterval(() => this.sweep(), 60 * 1000);
    this.sweepTimer.unref();
  }

  shutdown() {
    clearInterval(this.sweepTimer);
    for (const room of this.rooms.values()) {
      if (room.q) {
        clearTimeout(room.q.closeTimer);
        clearTimeout(room.q.earlyTimer);
      }
    }
    this.rooms.clear();
    this.bySocket.clear();
  }

  now() {
    return performance.now();
  }

  genCode() {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = "";
      for (let i = 0; i < 6; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("Could not allocate a room code");
  }

  createRoom({ college, setId, questionTime, examMode }) {
    const set = store.getSet(setId);
    if (!set) return { error: "That question set no longer exists" };
    const code = this.genCode();
    const room = {
      code,
      college: college || "Lloyd Institute",
      setId: set.id,
      setTitle: set.title,
      questions: set.questions.map((q) => ({ ...q })),
      settings: {
        questionTime: questionTime || set.questionTime || 20,
        examMode: !!examMode,
      },
      status: "lobby",
      hostToken: token(),
      hostSocketId: null,
      players: new Map(),
      qIndex: -1,
      q: null,
      rounds: [],
      stats: { rejectedLate: 0, rejectedDuplicate: 0, rejectedInvalid: 0, accepted: 0 },
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      lastActivity: Date.now(),
    };
    this.rooms.set(code, room);
    return { room };
  }

  getRoom(code) {
    return this.rooms.get(String(code || "").toUpperCase()) || null;
  }

  publicRoomInfo(room) {
    return {
      code: room.code,
      college: room.college,
      status: room.status,
      players: room.players.size,
      setTitle: room.setTitle,
      questionCount: room.questions.length,
    };
  }

  lobbyPayload(room) {
    return {
      code: room.code,
      college: room.college,
      status: room.status,
      setTitle: room.setTitle,
      questionCount: room.questions.length,
      settings: room.settings,
      scoring: this.scoringRule(room),
      players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, connected: p.connected, score: p.score })),
    };
  }

  scoringRule(room) {
    return {
      base: BASE_POINTS,
      bonus: BONUS_POINTS,
      wrong: room.settings.examMode ? -EXAM_PENALTY : 0,
      examMode: room.settings.examMode,
      text: room.settings.examMode
        ? `Correct: ${BASE_POINTS} + up to ${BONUS_POINTS} for speed. Wrong: minus ${EXAM_PENALTY} (exam mode). Skipped: 0.`
        : `Correct: ${BASE_POINTS} + up to ${BONUS_POINTS} for speed. Wrong or skipped: 0.`,
    };
  }

  attachHost(room, socket) {
    room.hostSocketId = socket.id;
    this.bySocket.set(socket.id, { code: room.code, role: "host" });
    socket.join(room.code);
    room.lastActivity = Date.now();
  }

  attachSpectator(room, socket) {
    this.bySocket.set(socket.id, { code: room.code, role: "spectator" });
    socket.join(room.code);
    socket.join(`${room.code}:watch`);
  }

  emitToScreens(room, event, payload) {
    if (room.hostSocketId) this.io.to(room.hostSocketId).emit(event, payload);
    this.io.to(`${room.code}:watch`).emit(event, payload);
  }

  uniqueName(room, name) {
    const taken = new Set([...room.players.values()].map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 100; i++) {
      const candidate = `${name.slice(0, 17)} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${name.slice(0, 14)} ${crypto.randomInt(1000)}`;
  }

  joinPlayer(room, socket, name) {
    if (room.status === "ended") return { error: "This game has already ended" };
    if (room.players.size >= MAX_PLAYERS) return { error: "This room is full" };
    const player = {
      id: token(6),
      token: token(),
      name: this.uniqueName(room, name),
      score: 0,
      socketId: socket.id,
      connected: true,
      rank: 0,
      prevRank: 0,
      lastPoints: 0,
      rttSamples: [],
      rtt: 0,
      perms: new Map(),
      answers: [],
      tabSwitches: 0,
      joinedAt: Date.now(),
    };
    room.players.set(player.id, player);
    this.bySocket.set(socket.id, { code: room.code, role: "player", playerId: player.id });
    socket.join(room.code);
    room.lastActivity = Date.now();
    this.broadcastLobby(room);
    return { player };
  }

  resumePlayer(room, socket, playerToken) {
    const player = [...room.players.values()].find((p) => p.token === playerToken);
    if (!player) return { error: "We could not find your seat in this room" };
    if (player.socketId && player.socketId !== socket.id) {
      const old = this.io.sockets.sockets.get(player.socketId);
      if (old) {
        this.bySocket.delete(old.id);
        old.emit("session:replaced");
        old.leave(room.code);
      }
    }
    player.socketId = socket.id;
    player.connected = true;
    this.bySocket.set(socket.id, { code: room.code, role: "player", playerId: player.id });
    socket.join(room.code);
    room.lastActivity = Date.now();
    this.broadcastLobby(room);
    return { player };
  }

  resumeHost(room, socket, hostToken) {
    if (room.hostToken !== hostToken) return { error: "Host key does not match this room" };
    this.attachHost(room, socket);
    return { ok: true };
  }

  handleDisconnect(socketId) {
    const ref = this.bySocket.get(socketId);
    if (!ref) return;
    this.bySocket.delete(socketId);
    const room = this.rooms.get(ref.code);
    if (!room) return;
    if (ref.role === "host") {
      if (room.hostSocketId === socketId) room.hostSocketId = null;
      return;
    }
    if (ref.role === "spectator") return;
    const player = room.players.get(ref.playerId);
    if (!player || player.socketId !== socketId) return;
    player.connected = false;
    player.socketId = null;
    this.broadcastLobby(room);
    if (room.status === "question") this.maybeCloseEarly(room);
  }

  recordRtt(socketId, rttMs) {
    const ref = this.bySocket.get(socketId);
    if (!ref || ref.role !== "player") return;
    const room = this.rooms.get(ref.code);
    const player = room?.players.get(ref.playerId);
    if (!player) return;
    player.rttSamples.push(rttMs);
    if (player.rttSamples.length > 6) player.rttSamples.shift();
    player.rtt = Math.min(...player.rttSamples);
  }

  recordVisibility(socketId, hidden) {
    const ref = this.bySocket.get(socketId);
    if (!ref || ref.role !== "player") return;
    const room = this.rooms.get(ref.code);
    const player = room?.players.get(ref.playerId);
    if (!player || !hidden || room.status !== "question") return;
    player.tabSwitches += 1;
    if (room.hostSocketId) this.io.to(room.hostSocketId).emit("player:flag", { id: player.id, name: player.name, tabSwitches: player.tabSwitches });
  }

  broadcastLobby(room) {
    this.io.to(room.code).emit("room:lobby", this.lobbyPayload(room));
  }

  startGame(room) {
    if (room.status !== "lobby") return { error: "Game already started" };
    if (room.players.size === 0) return { error: "Wait for at least one player to join" };
    room.startedAt = Date.now();
    this.startQuestion(room, 0);
    return { ok: true };
  }

  startQuestion(room, idx) {
    const question = room.questions[idx];
    if (!question) return this.endGame(room);
    room.qIndex = idx;
    room.status = "question";
    const durationMs = (question.time || room.settings.questionTime) * 1000;
    const startedAt = this.now();
    room.q = {
      startedAt,
      durationMs,
      deadline: startedAt + durationMs,
      answers: new Map(),
      closed: false,
      closeTimer: setTimeout(() => this.closeQuestion(room), durationMs + RTT_CAP_MS + GRACE_MS),
      earlyTimer: null,
    };
    room.lastActivity = Date.now();
    for (const player of room.players.values()) {
      player.perms.set(idx, shuffle(question.options.length));
      if (player.connected && player.socketId) {
        this.io.to(player.socketId).emit("question:start", this.playerQuestionPayload(room, player));
      }
    }
    this.emitToScreens(room, "question:start", this.hostQuestionPayload(room));
  }

  baseQuestionPayload(room) {
    const question = room.questions[room.qIndex];
    return {
      qIndex: room.qIndex,
      total: room.questions.length,
      text: question.text,
      image: question.image,
      table: question.table,
      topic: question.topic,
      difficulty: question.difficulty,
      durationMs: room.q.durationMs,
      remainingMs: Math.max(0, Math.round(room.q.deadline - this.now())),
      scoring: this.scoringRule(room),
    };
  }

  playerQuestionPayload(room, player) {
    const question = room.questions[room.qIndex];
    const perm = player.perms.get(room.qIndex) || shuffle(question.options.length);
    player.perms.set(room.qIndex, perm);
    const answer = room.q.answers.get(player.id);
    return {
      ...this.baseQuestionPayload(room),
      options: perm.map((i) => question.options[i]),
      answered: !!answer,
      answeredPos: answer ? answer.pos : null,
      answeredCount: room.q.answers.size,
      playerCount: this.connectedCount(room),
    };
  }

  hostQuestionPayload(room) {
    const question = room.questions[room.qIndex];
    return {
      ...this.baseQuestionPayload(room),
      options: question.options.slice(),
      answeredCount: room.q.answers.size,
      playerCount: this.connectedCount(room),
    };
  }

  connectedCount(room) {
    let n = 0;
    for (const p of room.players.values()) if (p.connected) n++;
    return n;
  }

  submitAnswer(room, player, qIndex, pos) {
    if (room.status !== "question" || !room.q || room.q.closed) return { accepted: false, reason: "closed" };
    if (qIndex !== room.qIndex) {
      room.stats.rejectedInvalid++;
      return { accepted: false, reason: "stale" };
    }
    if (room.q.answers.has(player.id)) {
      room.stats.rejectedDuplicate++;
      return { accepted: false, reason: "duplicate" };
    }
    const perm = player.perms.get(qIndex);
    if (!perm || !Number.isInteger(pos) || pos < 0 || pos >= perm.length) {
      room.stats.rejectedInvalid++;
      return { accepted: false, reason: "invalid" };
    }
    const question = room.questions[qIndex];
    const raw = this.now() - room.q.startedAt;
    const comp = Math.min(player.rtt || 0, RTT_CAP_MS);
    const elapsed = Math.max(0, raw - comp);
    if (elapsed > room.q.durationMs) {
      room.stats.rejectedLate++;
      return { accepted: false, reason: "late" };
    }
    const original = perm[pos];
    const correct = original === question.correct;
    const timeLeftFrac = Math.max(0, 1 - elapsed / room.q.durationMs);
    let points = 0;
    if (correct) points = BASE_POINTS + Math.round(BONUS_POINTS * timeLeftFrac);
    else if (room.settings.examMode) points = -EXAM_PENALTY;
    room.q.answers.set(player.id, { choice: original, pos, elapsed, raw, comp, correct, points, timeLeftFrac });
    room.stats.accepted++;
    room.lastActivity = Date.now();
    this.io.to(room.code).emit("question:progress", { qIndex, answeredCount: room.q.answers.size, playerCount: this.connectedCount(room) });
    this.maybeCloseEarly(room);
    return { accepted: true, elapsedMs: Math.round(elapsed) };
  }

  maybeCloseEarly(room) {
    if (!room.q || room.q.closed || room.q.earlyTimer) return;
    const connected = [...room.players.values()].filter((p) => p.connected);
    if (connected.length === 0) return;
    const everyone = connected.every((p) => room.q.answers.has(p.id));
    if (everyone) room.q.earlyTimer = setTimeout(() => this.closeQuestion(room), ALL_ANSWERED_DELAY_MS);
  }

  computeRanks(room) {
    const list = [...room.players.values()];
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = a.answers.reduce((s, x) => s + (x.elapsed ?? 0), 0);
      const tb = b.answers.reduce((s, x) => s + (x.elapsed ?? 0), 0);
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });
    list.forEach((p, i) => {
      p.rank = i + 1;
      if (!p.prevRank) p.prevRank = p.rank;
    });
    return list;
  }

  leaderboard(room) {
    return this.computeRanks(room).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      rank: p.rank,
      prevRank: p.prevRank,
      delta: p.prevRank - p.rank,
      lastPoints: p.lastPoints,
      connected: p.connected,
    }));
  }

  closeQuestion(room) {
    if (!room.q || room.q.closed) return;
    room.q.closed = true;
    clearTimeout(room.q.closeTimer);
    clearTimeout(room.q.earlyTimer);
    const question = room.questions[room.qIndex];
    for (const player of room.players.values()) {
      const a = room.q.answers.get(player.id);
      player.prevRank = player.rank || 0;
      player.lastPoints = a ? a.points : 0;
      player.score += player.lastPoints;
      player.answers.push({
        qIndex: room.qIndex,
        topic: question.topic,
        difficulty: question.difficulty,
        answered: !!a,
        correct: a ? a.correct : false,
        elapsed: a ? a.elapsed : null,
        timeLeftFrac: a ? a.timeLeftFrac : 0,
        points: a ? a.points : 0,
      });
    }
    this.computeRanks(room);
    const counts = question.options.map(() => 0);
    let correctCount = 0;
    let elapsedSum = 0;
    for (const a of room.q.answers.values()) {
      counts[a.choice]++;
      if (a.correct) correctCount++;
      elapsedSum += a.elapsed;
    }
    const answered = room.q.answers.size;
    room.rounds.push({
      qIndex: room.qIndex,
      counts,
      correct: question.correct,
      answered,
      correctCount,
      avgElapsedMs: answered ? Math.round(elapsedSum / answered) : null,
      pctCorrect: room.players.size ? Math.round((100 * correctCount) / room.players.size) : 0,
    });
    room.status = "reveal";
    room.lastActivity = Date.now();
    this.emitReveal(room);
  }

  revealBase(room) {
    const question = room.questions[room.qIndex];
    const round = room.rounds[room.rounds.length - 1];
    return {
      qIndex: room.qIndex,
      total: room.questions.length,
      isLast: room.qIndex >= room.questions.length - 1,
      text: question.text,
      explanation: question.explanation || "",
      topic: question.topic,
      answered: round.answered,
      correctCount: round.correctCount,
      playerCount: room.players.size,
      avgElapsedMs: round.avgElapsedMs,
    };
  }

  playerRevealPayload(room, player) {
    const question = room.questions[room.qIndex];
    const perm = player.perms.get(room.qIndex) || question.options.map((_, i) => i);
    const round = room.rounds[room.rounds.length - 1];
    const a = room.q.answers.get(player.id);
    const board = this.leaderboard(room);
    const me = board.find((e) => e.id === player.id);
    return {
      ...this.revealBase(room),
      options: perm.map((i) => question.options[i]),
      counts: perm.map((i) => round.counts[i]),
      correctPos: perm.indexOf(question.correct),
      you: a
        ? { answered: true, pos: a.pos, correct: a.correct, points: a.points, elapsedMs: Math.round(a.elapsed), compensationMs: Math.round(a.comp) }
        : { answered: false, pos: null, correct: false, points: 0, elapsedMs: null, compensationMs: 0 },
      top: board.slice(0, 5),
      me,
    };
  }

  hostRevealPayload(room) {
    const question = room.questions[room.qIndex];
    const round = room.rounds[room.rounds.length - 1];
    return {
      ...this.revealBase(room),
      options: question.options.slice(),
      counts: round.counts,
      correct: question.correct,
      leaderboard: this.leaderboard(room),
    };
  }

  emitReveal(room) {
    for (const player of room.players.values()) {
      if (player.connected && player.socketId) this.io.to(player.socketId).emit("question:reveal", this.playerRevealPayload(room, player));
    }
    this.emitToScreens(room, "question:reveal", this.hostRevealPayload(room));
  }

  nextQuestion(room) {
    if (room.status === "question") {
      this.closeQuestion(room);
      return { ok: true, closed: true };
    }
    if (room.status !== "reveal") return { error: "Nothing to advance" };
    if (room.qIndex + 1 >= room.questions.length) {
      this.endGame(room);
    } else {
      this.startQuestion(room, room.qIndex + 1);
    }
    return { ok: true };
  }

  playerReport(room, player) {
    const n = room.rounds.length;
    const answers = player.answers;
    const correct = answers.filter((a) => a.correct);
    const wrong = answers.filter((a) => a.answered && !a.correct);
    const skipped = answers.filter((a) => !a.answered);
    const topics = {};
    for (const a of answers) {
      const t = topics[a.topic] || { correct: 0, total: 0, elapsedSum: 0, answered: 0 };
      t.total++;
      if (a.correct) t.correct++;
      if (a.answered) {
        t.answered++;
        t.elapsedSum += a.elapsed;
      }
      topics[a.topic] = t;
    }
    const topicRows = Object.entries(topics).map(([topic, t]) => ({
      topic,
      correct: t.correct,
      total: t.total,
      accuracy: t.total ? Math.round((100 * t.correct) / t.total) : 0,
      avgSpeedS: t.answered ? round1(t.elapsedSum / t.answered / 1000) : null,
    }));
    const maxPerQ = BASE_POINTS + BONUS_POINTS;
    const speedCost = correct.reduce((s, a) => s + (maxPerQ - a.points), 0);
    const errorCost = wrong.reduce((s, a) => s + maxPerQ - a.points, 0);
    const missedCost = skipped.length * maxPerQ;
    const late = answers.filter((a) => a.answered && a.timeLeftFrac < 0.25);
    const early = answers.filter((a) => a.answered && a.timeLeftFrac >= 0.25);
    const afterMistake = answers.filter((a, i) => i > 0 && answers[i - 1].answered && !answers[i - 1].correct && a.answered);
    const acc = (arr) => (arr.length ? Math.round((100 * arr.filter((a) => a.correct).length) / arr.length) : null);
    const answeredList = answers.filter((a) => a.answered);
    const avgSpeedS = answeredList.length ? round1(answeredList.reduce((s, a) => s + a.elapsed, 0) / answeredList.length / 1000) : null;
    const fastestCorrectS = correct.length ? round1(Math.min(...correct.map((a) => a.elapsed)) / 1000) : null;
    return {
      name: player.name,
      score: player.score,
      rank: player.rank,
      players: room.players.size,
      questions: n,
      correct: correct.length,
      wrong: wrong.length,
      skipped: skipped.length,
      accuracy: n ? Math.round((100 * correct.length) / n) : 0,
      avgSpeedS,
      fastestCorrectS,
      topics: topicRows,
      pressure: {
        maxPossible: n * maxPerQ,
        earned: player.score,
        speedCost,
        errorCost,
        missedCost,
        lateAccuracy: acc(late),
        lateCount: late.length,
        earlyAccuracy: acc(early),
        earlyCount: early.length,
        afterMistakeAccuracy: acc(afterMistake),
        afterMistakeCount: afterMistake.length,
      },
      tabSwitches: player.tabSwitches,
    };
  }

  hostInsights(room) {
    const questions = room.rounds.map((r) => {
      const q = room.questions[r.qIndex];
      return {
        index: r.qIndex,
        text: q.text,
        topic: q.topic,
        difficulty: q.difficulty,
        options: q.options,
        correct: q.correct,
        counts: r.counts,
        answered: r.answered,
        correctCount: r.correctCount,
        pctCorrect: r.pctCorrect,
        avgElapsedMs: r.avgElapsedMs,
      };
    });
    const topics = {};
    for (const q of questions) {
      const t = topics[q.topic] || { correct: 0, total: 0 };
      t.total += room.players.size;
      t.correct += q.correctCount;
      topics[q.topic] = t;
    }
    const players = [...room.players.values()].map((p) => this.playerReport(room, p)).sort((a, b) => a.rank - b.rank);
    const rtts = [...room.players.values()].map((p) => p.rtt).filter((x) => x > 0);
    return {
      code: room.code,
      college: room.college,
      setTitle: room.setTitle,
      settings: room.settings,
      questions,
      hardest: [...questions].sort((a, b) => a.pctCorrect - b.pctCorrect).slice(0, 3),
      topics: Object.entries(topics).map(([topic, t]) => ({ topic, accuracy: t.total ? Math.round((100 * t.correct) / t.total) : 0 })),
      players,
      fairness: {
        rttCapMs: RTT_CAP_MS,
        avgRttMs: rtts.length ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length) : 0,
        maxRttMs: rtts.length ? Math.round(Math.max(...rtts)) : 0,
        ...room.stats,
      },
      startedAt: room.startedAt,
      endedAt: room.endedAt,
    };
  }

  endGame(room) {
    if (room.status === "ended") return;
    if (room.status === "question") this.closeQuestion(room);
    room.status = "ended";
    room.endedAt = Date.now();
    room.lastActivity = Date.now();
    this.computeRanks(room);
    const insights = this.hostInsights(room);
    try {
      store.addGame({
        code: room.code,
        college: room.college,
        setTitle: room.setTitle,
        examMode: room.settings.examMode,
        endedAt: new Date(room.endedAt).toISOString(),
        questions: room.questions.length,
        players: insights.players.map((p) => ({ name: p.name, score: p.score, correct: p.correct, questions: p.questions, avgSpeedS: p.avgSpeedS })),
      });
    } catch (err) {
      console.error("Could not persist game", err);
    }
    for (const player of room.players.values()) {
      if (player.connected && player.socketId) this.io.to(player.socketId).emit("game:end", this.playerEndPayload(room, player));
    }
    this.emitToScreens(room, "game:end", this.hostEndPayload(room, insights));
  }

  playerEndPayload(room, player) {
    return { report: this.playerReport(room, player), top: this.leaderboard(room).slice(0, 10), scoring: this.scoringRule(room) };
  }

  hostEndPayload(room, insights) {
    return { leaderboard: this.leaderboard(room), insights: insights || this.hostInsights(room), scoring: this.scoringRule(room) };
  }

  statePayloadForPlayer(room, player) {
    switch (room.status) {
      case "lobby":
        return { status: "lobby", lobby: this.lobbyPayload(room) };
      case "question":
        return { status: "question", question: this.playerQuestionPayload(room, player) };
      case "reveal":
        return { status: "reveal", reveal: this.playerRevealPayload(room, player) };
      case "ended":
        return { status: "ended", end: this.playerEndPayload(room, player) };
      default:
        return { status: room.status };
    }
  }

  statePayloadForHost(room) {
    switch (room.status) {
      case "lobby":
        return { status: "lobby", lobby: this.lobbyPayload(room) };
      case "question":
        return { status: "question", lobby: this.lobbyPayload(room), question: this.hostQuestionPayload(room) };
      case "reveal":
        return { status: "reveal", lobby: this.lobbyPayload(room), reveal: this.hostRevealPayload(room) };
      case "ended":
        return { status: "ended", lobby: this.lobbyPayload(room), end: this.hostEndPayload(room) };
      default:
        return { status: room.status };
    }
  }

  kickPlayer(room, playerId) {
    const player = room.players.get(playerId);
    if (!player) return false;
    if (player.socketId) {
      this.io.to(player.socketId).emit("player:kicked");
      this.bySocket.delete(player.socketId);
      const s = this.io.sockets.sockets.get(player.socketId);
      if (s) s.leave(room.code);
    }
    room.players.delete(playerId);
    this.broadcastLobby(room);
    return true;
  }

  sweep() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const idle = now - room.lastActivity;
      if ((room.status === "ended" && idle > 60 * 60 * 1000) || idle > ROOM_TTL_MS) {
        if (room.q) {
          clearTimeout(room.q.closeTimer);
          clearTimeout(room.q.earlyTimer);
        }
        this.io.to(code).emit("room:closed");
        this.rooms.delete(code);
      }
    }
  }
}
