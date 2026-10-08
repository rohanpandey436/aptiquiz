import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import * as store from "./store.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RTT_CAP_MS = 400;
const GRACE_MS = 60;
const ALL_ANSWERED_DELAY_MS = 900;
export const REVEAL_DELAY_MS = 8000;
export const BASE_POINTS = 500;
export const BONUS_POINTS = 500;
export const EXAM_PENALTY = 250;
export const MAX_PLAYERS = 60;
export const MAX_ROOMS = 300;
export const DIFFICULTIES = ["easy", "medium", "hard"];
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const ENDED_TTL_MS = 60 * 60 * 1000;
const LOBBY_TTL_MS = 20 * 60 * 1000;

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
    for (const room of this.rooms.values()) this.clearRoomTimers(room);
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

  questionsFor(set, difficulty) {
    const level = DIFFICULTIES.includes(difficulty) ? difficulty : "mixed";
    const chosen = level === "mixed" ? set.questions : set.questions.filter((q) => q.difficulty === level);
    return { level, questions: chosen.map((q) => ({ ...q })) };
  }

  createRoom({ college, setId, questionTime, examMode, autoAdvance = true, practice = false, difficulty = "mixed" }) {
    if (this.rooms.size >= MAX_ROOMS) return { error: "The server is busy right now. Try again in a few minutes." };
    const set = store.getSet(setId);
    if (!set) return { error: "That question set no longer exists" };
    const picked = this.questionsFor(set, difficulty);
    if (!picked.questions.length) return { error: `This set has no ${picked.level} questions. Pick another level.` };
    const code = this.genCode();
    const room = {
      code,
      college: college || "Lloyd Institute",
      setId: set.id,
      setTitle: set.title,
      questions: picked.questions,
      settings: {
        questionTime: questionTime || set.questionTime || 20,
        examMode: !!examMode,
        autoAdvance: !!autoAdvance,
        difficulty: picked.level,
      },
      practice: !!practice,
      status: "lobby",
      hostToken: token(),
      hostSocketId: null,
      players: new Map(),
      banned: { names: new Set(), addresses: new Set() },
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

  updateRoom(room, { setId, questionTime, examMode, college, autoAdvance, difficulty }) {
    if (room.status !== "lobby") return { error: "Settings can only change before the game starts" };
    const wantsSet = setId && setId !== room.setId;
    const wantsLevel = difficulty && difficulty !== room.settings.difficulty;
    if (wantsSet || wantsLevel) {
      const set = store.getSet(wantsSet ? setId : room.setId);
      if (!set) return { error: "That question set no longer exists" };
      const picked = this.questionsFor(set, wantsLevel ? difficulty : room.settings.difficulty);
      if (!picked.questions.length) return { error: `This set has no ${picked.level} questions. Pick another level.` };
      room.setId = set.id;
      room.setTitle = set.title;
      room.questions = picked.questions;
      room.settings.difficulty = picked.level;
      if (wantsSet && !questionTime) room.settings.questionTime = set.questionTime || 20;
    }
    if (questionTime) room.settings.questionTime = questionTime;
    if (typeof examMode === "boolean") room.settings.examMode = examMode;
    if (typeof autoAdvance === "boolean") room.settings.autoAdvance = autoAdvance;
    if (college) room.college = college;
    room.lastActivity = Date.now();
    this.broadcastLobby(room);
    return { ok: true };
  }

  getRoom(code) {
    return this.rooms.get(String(code || "").toUpperCase()) || null;
  }

  setsInPlay() {
    const ids = new Set();
    for (const room of this.rooms.values()) if (room.status !== "ended") ids.add(room.setId);
    return ids;
  }

  publicRoomInfo(room) {
    return {
      code: room.code,
      college: room.college,
      status: room.status,
      players: room.players.size,
      questionCount: room.questions.length,
    };
  }

  lobbyPayload(room) {
    return {
      code: room.code,
      college: room.college,
      status: room.status,
      setId: room.setId,
      setTitle: room.setTitle,
      questionCount: room.questions.length,
      settings: room.settings,
      practice: room.practice,
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

  detach(socket) {
    const ref = this.bySocket.get(socket.id);
    if (!ref) return null;
    this.handleDisconnect(socket.id);
    socket.leave(ref.code);
    socket.leave(`${ref.code}:watch`);
    return ref;
  }

  attachHost(room, socket) {
    this.detach(socket);
    room.hostSocketId = socket.id;
    this.bySocket.set(socket.id, { code: room.code, role: "host" });
    socket.join(room.code);
    room.lastActivity = Date.now();
  }

  attachSpectator(room, socket) {
    this.detach(socket);
    this.bySocket.set(socket.id, { code: room.code, role: "spectator" });
    socket.join(room.code);
    socket.join(`${room.code}:watch`);
  }

  emitToScreens(room, event, hostPayload, spectatorPayload = hostPayload) {
    if (room.hostSocketId) this.io.to(room.hostSocketId).emit(event, hostPayload);
    this.io.to(`${room.code}:watch`).emit(event, spectatorPayload);
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

  joinPlayer(room, socket, name, address = "") {
    if (room.status === "ended") return { error: "This game has already ended" };
    if (room.banned.names.has(name.toLowerCase()) || (address && room.banned.addresses.has(address))) {
      return { error: "The host has removed you from this room" };
    }
    const existing = this.bySocket.get(socket.id);
    if (existing?.role === "player" && existing.code === room.code) {
      const current = room.players.get(existing.playerId);
      if (current) return { error: `This device is already in the room as ${current.name}. Refresh the page to continue.` };
    }
    if (room.players.size >= MAX_PLAYERS) return { error: "This room is full" };
    this.detach(socket);
    const player = {
      id: token(6),
      token: token(),
      name: this.uniqueName(room, name),
      address,
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
    this.cancelEarlyCloseFor(room, player);
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
    this.detach(socket);
    player.socketId = socket.id;
    player.connected = true;
    this.bySocket.set(socket.id, { code: room.code, role: "player", playerId: player.id });
    socket.join(room.code);
    room.lastActivity = Date.now();
    this.cancelEarlyCloseFor(room, player);
    this.broadcastLobby(room);
    return { player };
  }

  cancelEarlyCloseFor(room, player) {
    if (room.status !== "question" || !room.q || room.q.closed || !room.q.earlyTimer) return;
    if (!room.q.answers.has(player.id)) {
      clearTimeout(room.q.earlyTimer);
      room.q.earlyTimer = null;
    }
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
    if (ref.role !== "player") return;
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
    this.clearRoomTimers(room);
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
      advanceTimer: null,
      advanceAt: null,
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

  everyoneAnswered(room) {
    const connected = [...room.players.values()].filter((p) => p.connected);
    return connected.length > 0 && connected.every((p) => room.q.answers.has(p.id));
  }

  maybeCloseEarly(room) {
    if (!room.q || room.q.closed || room.q.earlyTimer) return;
    if (!this.everyoneAnswered(room)) return;
    room.q.earlyTimer = setTimeout(() => {
      room.q.earlyTimer = null;
      if (!room.q.closed && this.everyoneAnswered(room)) this.closeQuestion(room);
    }, ALL_ANSWERED_DELAY_MS);
  }

  computeRanks(room) {
    const list = [...room.players.values()];
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = a.answers.reduce((s, x) => s + x.elapsed, 0);
      const tb = b.answers.reduce((s, x) => s + x.elapsed, 0);
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

  clearRoomTimers(room) {
    if (!room.q) return;
    clearTimeout(room.q.closeTimer);
    clearTimeout(room.q.earlyTimer);
    clearTimeout(room.q.advanceTimer);
    room.q.earlyTimer = null;
    room.q.advanceTimer = null;
    room.q.advanceAt = null;
  }

  closeQuestion(room) {
    if (!room.q || room.q.closed) return;
    room.q.closed = true;
    this.clearRoomTimers(room);
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
        elapsed: a ? a.elapsed : room.q.durationMs,
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
      players: room.players.size,
      avgElapsedMs: answered ? Math.round(elapsedSum / answered) : null,
      pctCorrect: room.players.size ? Math.round((100 * correctCount) / room.players.size) : 0,
    });
    room.status = "reveal";
    room.lastActivity = Date.now();
    if (room.settings.autoAdvance) this.scheduleAdvance(room);
    this.emitReveal(room);
  }

  scheduleAdvance(room, delayMs = REVEAL_DELAY_MS) {
    if (!room.q) return;
    clearTimeout(room.q.advanceTimer);
    room.q.advanceAt = Date.now() + delayMs;
    room.q.advanceTimer = setTimeout(() => {
      room.q.advanceTimer = null;
      room.q.advanceAt = null;
      if (room.status === "reveal") this.nextQuestion(room);
    }, delayMs);
  }

  autoNextMs(room) {
    if (!room.q?.advanceAt) return null;
    return Math.max(0, room.q.advanceAt - Date.now());
  }

  setAutoAdvance(room, enabled) {
    room.settings.autoAdvance = !!enabled;
    if (room.status === "reveal" && room.q) {
      if (enabled) this.scheduleAdvance(room);
      else {
        clearTimeout(room.q.advanceTimer);
        room.q.advanceTimer = null;
        room.q.advanceAt = null;
      }
    }
    this.io.to(room.code).emit("room:auto", { autoAdvance: room.settings.autoAdvance, autoNextMs: this.autoNextMs(room) });
    return { ok: true };
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
      autoAdvance: room.settings.autoAdvance,
      autoNextMs: this.autoNextMs(room),
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

  closeRound(room) {
    if (room.status !== "question") return { error: "No round is open" };
    this.closeQuestion(room);
    return { ok: true };
  }

  nextQuestion(room) {
    if (room.status !== "reveal") return { error: "Wait for the round to finish before moving on" };
    room.lastActivity = Date.now();
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
    const skippedCount = answers.filter((a) => !a.answered).length + Math.max(0, n - answers.length);
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
    const missedCost = skippedCount * maxPerQ;
    const late = answers.filter((a) => a.answered && a.timeLeftFrac < 0.25);
    const early = answers.filter((a) => a.answered && a.timeLeftFrac >= 0.25);
    const afterMistake = answers.filter((a, i) => i > 0 && answers[i - 1].answered && !answers[i - 1].correct && a.answered);
    const acc = (arr) => (arr.length ? Math.round((100 * arr.filter((a) => a.correct).length) / arr.length) : null);
    const ranked = topicRows.filter((t) => t.total > 0).sort((a, b) => b.accuracy - a.accuracy || b.total - a.total);
    const bestTopic = ranked.length ? ranked[0].topic : null;
    const weakestTopic = ranked.length > 1 ? ranked[ranked.length - 1].topic : null;
    const answeredList = answers.filter((a) => a.answered);
    const avgSpeedS = answeredList.length ? round1(answeredList.reduce((s, a) => s + a.elapsed, 0) / answeredList.length / 1000) : null;
    const fastestCorrectS = correct.length ? round1(Math.min(...correct.map((a) => a.elapsed)) / 1000) : null;
    return {
      id: player.id,
      name: player.name,
      score: player.score,
      rank: player.rank,
      players: room.players.size,
      questions: n,
      correct: correct.length,
      wrong: wrong.length,
      skipped: skippedCount,
      accuracy: n ? Math.round((100 * correct.length) / n) : 0,
      avgSpeedS,
      fastestCorrectS,
      topics: topicRows,
      bestTopic,
      weakestTopic,
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

  roomInsights(room) {
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
    for (const r of room.rounds) {
      const q = room.questions[r.qIndex];
      const t = topics[q.topic] || { correct: 0, total: 0 };
      t.total += r.players;
      t.correct += r.correctCount;
      topics[q.topic] = t;
    }
    return {
      code: room.code,
      college: room.college,
      setTitle: room.setTitle,
      settings: room.settings,
      practice: room.practice,
      questions,
      hardest: [...questions].sort((a, b) => a.pctCorrect - b.pctCorrect).slice(0, 3),
      topics: Object.entries(topics).map(([topic, t]) => ({ topic, accuracy: t.total ? Math.round((100 * t.correct) / t.total) : 0 })),
      startedAt: room.startedAt,
      endedAt: room.endedAt,
    };
  }

  hostInsights(room) {
    const players = [...room.players.values()].map((p) => this.playerReport(room, p)).sort((a, b) => a.rank - b.rank);
    const rtts = [...room.players.values()].map((p) => p.rtt).filter((x) => x > 0);
    return {
      ...this.roomInsights(room),
      players,
      fairness: {
        rttCapMs: RTT_CAP_MS,
        avgRttMs: rtts.length ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length) : 0,
        maxRttMs: rtts.length ? Math.round(Math.max(...rtts)) : 0,
        ...room.stats,
      },
    };
  }

  endGame(room) {
    if (room.status === "ended") return;
    if (room.status === "question") this.closeQuestion(room);
    this.clearRoomTimers(room);
    room.status = "ended";
    room.endedAt = Date.now();
    room.lastActivity = Date.now();
    this.computeRanks(room);
    const insights = this.hostInsights(room);
    if (room.rounds.length > 0 && !room.practice) {
      try {
        store.addGame({
          code: room.code,
          college: room.college,
          setTitle: room.setTitle,
          examMode: room.settings.examMode,
          endedAt: new Date(room.endedAt).toISOString(),
          questions: room.rounds.length,
          players: insights.players.map((p) => ({ name: p.name, score: p.score, correct: p.correct, questions: p.questions, avgSpeedS: p.avgSpeedS })),
        });
      } catch (err) {
        console.error("Could not persist game", err);
      }
    }
    for (const player of room.players.values()) {
      if (player.connected && player.socketId) this.io.to(player.socketId).emit("game:end", this.playerEndPayload(room, player));
    }
    this.emitToScreens(room, "game:end", this.hostEndPayload(room, insights), this.spectatorEndPayload(room));
  }

  playerEndPayload(room, player) {
    return { report: this.playerReport(room, player), top: this.leaderboard(room).slice(0, 10), scoring: this.scoringRule(room), practice: room.practice };
  }

  hostEndPayload(room, insights) {
    return { leaderboard: this.leaderboard(room), insights: insights || this.hostInsights(room), scoring: this.scoringRule(room) };
  }

  spectatorEndPayload(room) {
    return { leaderboard: this.leaderboard(room), insights: this.roomInsights(room), scoring: this.scoringRule(room) };
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

  statePayloadForScreen(room, { spectator = false } = {}) {
    const lobby = this.lobbyPayload(room);
    switch (room.status) {
      case "lobby":
        return { status: "lobby", lobby };
      case "question":
        return { status: "question", lobby, question: this.hostQuestionPayload(room) };
      case "reveal":
        return { status: "reveal", lobby, reveal: this.hostRevealPayload(room) };
      case "ended":
        return { status: "ended", lobby, end: spectator ? this.spectatorEndPayload(room) : this.hostEndPayload(room) };
      default:
        return { status: room.status };
    }
  }

  statePayloadForHost(room) {
    return this.statePayloadForScreen(room);
  }

  statePayloadForSpectator(room) {
    return this.statePayloadForScreen(room, { spectator: true });
  }

  kickPlayer(room, playerId) {
    const player = room.players.get(playerId);
    if (!player) return false;
    room.banned.names.add(player.name.toLowerCase());
    if (player.address) room.banned.addresses.add(player.address);
    if (player.socketId) {
      this.io.to(player.socketId).emit("player:kicked");
      this.bySocket.delete(player.socketId);
      const s = this.io.sockets.sockets.get(player.socketId);
      if (s) s.leave(room.code);
    }
    room.players.delete(playerId);
    if (room.q && !room.q.closed) room.q.answers.delete(playerId);
    this.broadcastLobby(room);
    if (room.status === "question") this.maybeCloseEarly(room);
    return true;
  }

  closeRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    this.clearRoomTimers(room);
    this.io.to(code).emit("room:closed");
    for (const [socketId, ref] of this.bySocket) if (ref.code === code) this.bySocket.delete(socketId);
    this.rooms.delete(code);
  }

  sweep() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const idle = now - room.lastActivity;
      const expired =
        (room.status === "ended" && idle > ENDED_TTL_MS) || (room.status === "lobby" && idle > LOBBY_TTL_MS) || idle > ROOM_TTL_MS;
      if (expired) this.closeRoom(code);
    }
  }
}
