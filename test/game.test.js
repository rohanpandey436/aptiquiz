import test from "node:test";
import assert from "node:assert/strict";
import { GameManager, BASE_POINTS, BONUS_POINTS, EXAM_PENALTY, RTT_CAP_MS } from "../server/game.js";
import * as store from "../server/store.js";

store.init("./data-test");

const managers = [];
test.after(() => managers.forEach((g) => g.shutdown()));

function fakeIo() {
  const sent = [];
  const sockets = new Map();
  return {
    sent,
    sockets: { sockets },
    to(target) {
      return { emit: (event, payload) => sent.push({ target, event, payload }) };
    },
  };
}

function fakeSocket(id) {
  return { id, join() {}, leave() {}, emit() {} };
}

function setup({ examMode = false, questionTime = 10, autoAdvance = false } = {}) {
  const io = fakeIo();
  const game = new GameManager(io);
  managers.push(game);
  const { room } = game.createRoom({ college: "Test College", setId: "seed_lightning", questionTime, examMode, autoAdvance, practice: true });
  game.attachHost(room, fakeSocket("host"));
  const a = game.joinPlayer(room, fakeSocket("sa"), "Asha", "10.0.0.1").player;
  const b = game.joinPlayer(room, fakeSocket("sb"), "Bilal", "10.0.0.2").player;
  return { io, game, room, a, b };
}

test("room codes avoid confusable characters and are unique", () => {
  const { game } = setup();
  const codes = new Set(Array.from({ length: 200 }, () => game.genCode()));
  assert.equal(codes.size, 200);
  for (const code of codes) assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
});

test("duplicate names get a suffix instead of colliding", () => {
  const { game, room } = setup();
  const again = game.joinPlayer(room, fakeSocket("sc"), "Asha").player;
  assert.equal(again.name, "Asha 2");
});

test("one connection holds one seat: a second join from the same socket is refused", () => {
  const { game, room } = setup();
  const socket = fakeSocket("sa");
  const result = game.joinPlayer(room, socket, "Ghost");
  assert.match(result.error, /already in the room as Asha/);
  assert.equal(room.players.size, 2);
});

test("a kicked player cannot rejoin with the same name or address, and their open answer is dropped", () => {
  const { game, room, a } = setup();
  game.startGame(room);
  game.submitAnswer(room, a, 0, 0);
  game.kickPlayer(room, a.id);
  assert.equal(room.q.answers.has(a.id), false);
  assert.match(game.joinPlayer(room, fakeSocket("sx"), "asha", "10.0.0.9").error, /removed you/);
  assert.match(game.joinPlayer(room, fakeSocket("sy"), "Someone", "10.0.0.1").error, /removed you/);
});

test("lobby settings can change before the game starts, not after", () => {
  const { game, room } = setup();
  const updated = game.updateRoom(room, { setId: "seed_verbal", questionTime: 15, examMode: true, college: "Other College" });
  assert.equal(updated.ok, true);
  assert.equal(room.setId, "seed_verbal");
  assert.equal(room.settings.questionTime, 15);
  assert.equal(room.settings.examMode, true);
  assert.equal(room.college, "Other College");
  game.startGame(room);
  assert.match(game.updateRoom(room, { questionTime: 30 }).error, /before the game starts/);
});

test("players see shuffled options and the correct answer is never in the payload", () => {
  const { game, room, a } = setup();
  game.startGame(room);
  const payload = game.playerQuestionPayload(room, a);
  const question = room.questions[0];
  assert.deepEqual([...payload.options].sort(), [...question.options].sort());
  assert.equal("correct" in payload, false);
  const perm = a.perms.get(0);
  assert.equal(payload.options[perm.indexOf(question.correct)], question.options[question.correct]);
});

test("a position answer is mapped back through the player's own permutation", () => {
  const { game, room, a } = setup();
  game.startGame(room);
  const question = room.questions[0];
  const correctPos = a.perms.get(0).indexOf(question.correct);
  const res = game.submitAnswer(room, a, 0, correctPos);
  assert.equal(res.accepted, true);
  assert.equal(room.q.answers.get(a.id).correct, true);
});

test("scoring rewards speed and exam mode penalises wrong answers", () => {
  const { game, room, a, b } = setup({ examMode: true, questionTime: 10 });
  game.startGame(room);
  const question = room.questions[0];
  const correctPos = a.perms.get(0).indexOf(question.correct);
  const wrongPos = (b.perms.get(0).indexOf(question.correct) + 1) % question.options.length;
  game.submitAnswer(room, a, 0, correctPos);
  game.submitAnswer(room, b, 0, wrongPos);
  const fast = room.q.answers.get(a.id);
  assert.ok(fast.points > BASE_POINTS + BONUS_POINTS * 0.9, "an instant correct answer earns almost the full bonus");
  assert.equal(room.q.answers.get(b.id).points, -EXAM_PENALTY);
  game.closeQuestion(room);
  assert.equal(b.score, -EXAM_PENALTY);
  assert.equal(a.score, fast.points);
});

test("second answers, stale questions and invalid positions are rejected", () => {
  const { game, room, a } = setup();
  game.startGame(room);
  assert.equal(game.submitAnswer(room, a, 0, 0).accepted, true);
  assert.equal(game.submitAnswer(room, a, 0, 1).reason, "duplicate");
  assert.equal(game.submitAnswer(room, a, 3, 0).reason, "stale");
  game.closeQuestion(room);
  game.nextQuestion(room);
  assert.equal(game.submitAnswer(room, a, 1, 99).reason, "invalid");
  assert.equal(room.stats.rejectedDuplicate, 1);
  assert.equal(room.stats.rejectedInvalid, 2);
});

test("late answers are judged on the compensated clock", () => {
  const { game, room, a, b } = setup({ questionTime: 10 });
  game.startGame(room);
  const started = room.q.startedAt;
  game.now = () => started + 10_150;
  assert.equal(game.submitAnswer(room, a, 0, 0).reason, "late", "no measured delay, 150 ms past the deadline is late");
  b.rtt = 300;
  assert.equal(game.submitAnswer(room, b, 0, 0).accepted, true, "a 300 ms round trip earns 300 ms of credit");
  assert.equal(Math.round(room.q.answers.get(b.id).elapsed), 9_850);
});

test("round-trip compensation is capped", () => {
  const { game, room, a } = setup({ questionTime: 10 });
  game.startGame(room);
  a.rtt = 5_000;
  game.now = () => room.q.startedAt + 10_000 + RTT_CAP_MS + 1;
  assert.equal(game.submitAnswer(room, a, 0, 0).reason, "late");
});

test("the question closes early once every connected player has answered", async () => {
  const { game, room, a } = setup();
  game.startGame(room);
  game.submitAnswer(room, a, 0, 0);
  game.handleDisconnect("sb");
  await new Promise((r) => setTimeout(r, 1_100));
  assert.equal(room.status, "reveal");
});

test("a player who comes back before the early close keeps the round open", async () => {
  const { game, room, a, b } = setup();
  game.startGame(room);
  game.submitAnswer(room, a, 0, 0);
  game.handleDisconnect("sb");
  assert.ok(room.q.earlyTimer, "early close armed while Bilal is away");
  game.resumePlayer(room, fakeSocket("sb2"), b.token);
  assert.equal(room.q.earlyTimer, null, "early close cancelled when Bilal returns unanswered");
  await new Promise((r) => setTimeout(r, 1_100));
  assert.equal(room.status, "question");
});

test("closing a round and moving on are separate actions", () => {
  const { game, room } = setup();
  game.startGame(room);
  assert.match(game.nextQuestion(room).error, /Wait for the round/);
  assert.equal(game.closeRound(room).ok, true);
  assert.equal(room.status, "reveal");
  assert.match(game.closeRound(room).error, /No round is open/);
  assert.equal(game.nextQuestion(room).ok, true);
  assert.equal(room.qIndex, 1);
});

test("auto-advance schedules the next question after the reveal and can be paused", () => {
  const { game, room } = setup({ autoAdvance: true });
  game.startGame(room);
  game.closeRound(room);
  const reveal = game.hostRevealPayload(room);
  assert.equal(reveal.autoAdvance, true);
  assert.ok(reveal.autoNextMs > 7_000 && reveal.autoNextMs <= 8_000);
  game.setAutoAdvance(room, false);
  assert.equal(room.q.advanceTimer, null);
  assert.equal(game.hostRevealPayload(room).autoNextMs, null);
});

test("ranks break ties by total answering time, and skipping is never faster than answering", () => {
  const { game, room, a, b } = setup();
  game.startGame(room);
  const q = room.questions[0];
  const started = room.q.startedAt;
  game.now = () => started + 2_000;
  game.submitAnswer(room, b, 0, b.perms.get(0).indexOf(q.correct));
  game.now = () => started + 4_000;
  game.submitAnswer(room, a, 0, a.perms.get(0).indexOf(q.correct));
  game.closeQuestion(room);
  let board = game.leaderboard(room);
  assert.equal(board[0].name, "Bilal");
  assert.equal(board[0].delta, 0, "first round shows no movement");
  game.nextQuestion(room);
  const q2 = room.questions[1];
  game.now = () => room.q.startedAt + 8_000;
  game.submitAnswer(room, a, 1, (a.perms.get(1).indexOf(q2.correct) + 1) % q2.options.length);
  game.closeQuestion(room);
  board = game.leaderboard(room);
  assert.equal(board[0].name, "Bilal", "Bilal still leads on score");
  const asha = room.players.get(a.id);
  const bilal = room.players.get(b.id);
  assert.equal(bilal.answers[1].elapsed, room.q.durationMs, "a skipped round counts as the full duration");
  assert.ok(asha.answers[1].elapsed < bilal.answers[1].elapsed);
});

test("a resumed player keeps score and gets the open question with remaining time", () => {
  const { game, room, a } = setup({ questionTime: 10 });
  game.startGame(room);
  game.handleDisconnect("sa");
  assert.equal(a.connected, false);
  const res = game.resumePlayer(room, fakeSocket("sa2"), a.token);
  assert.equal(res.player.id, a.id);
  const state = game.statePayloadForPlayer(room, a);
  assert.equal(state.status, "question");
  assert.ok(state.question.remainingMs > 0 && state.question.remainingMs <= 10_000);
});

test("the end-of-game report separates speed, error and skip costs and counts only played rounds", () => {
  const { game, room, a, b } = setup({ questionTime: 10 });
  game.startGame(room);
  const q0 = room.questions[0];
  game.now = () => room.q.startedAt + 5_000;
  game.submitAnswer(room, a, 0, a.perms.get(0).indexOf(q0.correct));
  game.submitAnswer(room, b, 0, (b.perms.get(0).indexOf(q0.correct) + 1) % q0.options.length);
  game.endGame(room);
  const ra = game.playerReport(room, a);
  const rb = game.playerReport(room, b);
  assert.equal(ra.questions, 1);
  assert.equal(ra.correct, 1);
  assert.equal(ra.pressure.speedCost, BASE_POINTS + BONUS_POINTS - ra.score);
  assert.equal(ra.pressure.missedCost, 0);
  assert.equal(ra.pressure.maxPossible, BASE_POINTS + BONUS_POINTS);
  assert.equal(rb.pressure.errorCost, BASE_POINTS + BONUS_POINTS);
  assert.equal(room.status, "ended");
});

test("a late joiner is charged for the rounds they missed", () => {
  const { game, room, a } = setup({ questionTime: 10 });
  game.startGame(room);
  game.submitAnswer(room, a, 0, 0);
  game.closeQuestion(room);
  game.nextQuestion(room);
  const late = game.joinPlayer(room, fakeSocket("sl"), "Latecomer").player;
  game.closeQuestion(room);
  game.endGame(room);
  const report = game.playerReport(room, late);
  assert.equal(report.questions, 2);
  assert.equal(report.skipped, 2);
  assert.equal(report.pressure.missedCost, 2 * (BASE_POINTS + BONUS_POINTS));
  assert.equal(report.pressure.earned + report.pressure.speedCost + report.pressure.errorCost + report.pressure.missedCost, report.pressure.maxPossible);
});

test("spectators get standings and question stats but never private player reports", () => {
  const { game, room } = setup();
  game.startGame(room);
  game.closeQuestion(room);
  game.endGame(room);
  const forHost = game.hostEndPayload(room);
  const forScreen = game.spectatorEndPayload(room);
  assert.ok(Array.isArray(forHost.insights.players));
  assert.equal("players" in forScreen.insights, false);
  assert.equal("fairness" in forScreen.insights, false);
  assert.equal(forScreen.leaderboard.length, 2);
});

test("answer keys are hidden for sets that are being played", () => {
  const { game, room } = setup();
  assert.ok(game.setsInPlay().has("seed_lightning"));
  const locked = store.withoutAnswers(store.getSet("seed_lightning"));
  assert.equal(locked.locked, true);
  assert.ok(locked.questions.every((q) => !("correct" in q) && !("explanation" in q)));
  game.endGame(room);
  assert.equal(game.setsInPlay().has("seed_lightning"), false);
});
