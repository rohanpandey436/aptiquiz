import test from "node:test";
import assert from "node:assert/strict";
import { GameManager, BASE_POINTS, BONUS_POINTS, EXAM_PENALTY, RTT_CAP_MS } from "../server/game.js";
import * as store from "../server/store.js";

process.env.DATA_DIR = "./data-test";
store.init();

function fakeIo() {
  const sent = [];
  const sockets = new Map();
  const io = {
    sent,
    sockets: { sockets },
    to(target) {
      return { emit: (event, payload) => sent.push({ target, event, payload }) };
    },
  };
  return io;
}

function fakeSocket(id) {
  return { id, join() {}, leave() {}, emit() {} };
}

const managers = [];
test.after(() => managers.forEach((g) => g.shutdown()));

function setup({ examMode = false, questionTime = 10 } = {}) {
  const io = fakeIo();
  const game = new GameManager(io);
  managers.push(game);
  const { room } = game.createRoom({ college: "Test College", setId: "seed_lightning", questionTime, examMode });
  game.attachHost(room, fakeSocket("host"));
  const a = game.joinPlayer(room, fakeSocket("sa"), "Asha").player;
  const b = game.joinPlayer(room, fakeSocket("sb"), "Bilal").player;
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
  const { game, room, a, b } = setup();
  game.startGame(room);
  game.submitAnswer(room, a, 0, 0);
  b.connected = false;
  game.handleDisconnect("sb");
  await new Promise((r) => setTimeout(r, 1_100));
  assert.equal(room.status, "reveal");
});

test("ranks break ties by total answering time and report movement", () => {
  const { game, room, a, b } = setup();
  game.startGame(room);
  const q = room.questions[0];
  const started = room.q.startedAt;
  game.now = () => started + 2_000;
  game.submitAnswer(room, b, 0, b.perms.get(0).indexOf(q.correct));
  game.now = () => started + 4_000;
  game.submitAnswer(room, a, 0, a.perms.get(0).indexOf(q.correct));
  game.closeQuestion(room);
  const board = game.leaderboard(room);
  assert.equal(board[0].name, "Bilal");
  assert.equal(board[0].rank, 1);
  assert.equal(board[1].name, "Asha");
  assert.equal(board[0].delta, 0, "first round shows no movement");
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

test("the end-of-game report separates speed, error and skip costs", () => {
  const { game, room, a, b } = setup({ questionTime: 10 });
  game.startGame(room);
  const q0 = room.questions[0];
  game.now = () => room.q.startedAt + 5_000;
  game.submitAnswer(room, a, 0, a.perms.get(0).indexOf(q0.correct));
  game.submitAnswer(room, b, 0, (b.perms.get(0).indexOf(q0.correct) + 1) % q0.options.length);
  game.endGame(room);
  const ra = game.playerReport(room, a);
  const rb = game.playerReport(room, b);
  assert.equal(ra.correct, 1);
  assert.equal(ra.pressure.speedCost, BASE_POINTS + BONUS_POINTS - ra.score);
  assert.equal(ra.questions, 1, "only questions actually played count");
  assert.equal(ra.pressure.missedCost, 0);
  assert.equal(ra.pressure.maxPossible, BASE_POINTS + BONUS_POINTS);
  assert.equal(rb.pressure.errorCost, BASE_POINTS + BONUS_POINTS);
  assert.equal(room.status, "ended");
});
