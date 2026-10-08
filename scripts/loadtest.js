import { io } from "socket.io-client";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  }),
);

const URL = args.url || "http://localhost:3000";
const PLAYERS = Number(args.players || 50);
const SET_ID = args.set || "seed_lightning";
const COLLEGE = args.college || "Load Test College";
const FAST = !!args.fast;
const QUESTION_TIME = Number(args.time || 0);
const JOIN_CODE = args.join ? String(args.join).toUpperCase() : "";

const NAMES = [
  "Aarav", "Diya", "Kabir", "Sana", "Ishaan", "Meera", "Rehan", "Anvi", "Vihaan", "Zara",
  "Arjun", "Nisha", "Dev", "Pooja", "Yash", "Riya", "Kunal", "Tara", "Om", "Navya",
  "Rohit", "Simran", "Aditya", "Kiara", "Manav", "Ira", "Parth", "Mahi", "Nikhil", "Esha",
  "Harsh", "Avni", "Sahil", "Prisha", "Ayaan", "Ananya", "Vivaan", "Myra", "Laksh", "Saanvi",
  "Tanish", "Aarohi", "Rudra", "Pari", "Shaurya", "Kavya", "Dhruv", "Naina", "Aryan", "Ruhi",
];

const stats = {
  joinMs: [],
  ackMs: [],
  accepted: 0,
  rejected: {},
  questionsSeen: new Map(),
  revealsSeen: new Map(),
  reconnects: 0,
  errors: [],
};

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => min + Math.random() * (max - min);

function connect() {
  return io(URL, { transports: ["websocket"], forceNew: true, reconnection: true });
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => socket.timeout(10000).emit(event, payload, (err, res) => resolve(err ? { error: String(err) } : res)));
}

async function runHost() {
  const host = connect();
  await new Promise((resolve) => host.on("connect", resolve));
  const created = await emitWithAck(host, "host:create", { setId: SET_ID, college: COLLEGE, questionTime: QUESTION_TIME || undefined, practice: true });
  if (!created?.ok) throw new Error(`host:create failed: ${JSON.stringify(created)}`);
  return { host, code: created.code, hostToken: created.hostToken };
}

async function spawnPlayer(index, code, behaviour) {
  const socket = connect();
  const name = JOIN_CODE ? `${NAMES[index % NAMES.length]}${index >= NAMES.length ? ` ${Math.floor(index / NAMES.length) + 1}` : ""}` : `Bot ${index + 1}`;
  const seen = { questions: 0, reveals: 0 };
  let token = null;
  let questionDone = false;

  socket.on("rtt:probe", (ack) => {
    if (typeof ack === "function") ack();
  });
  socket.on("question:start", async (q) => {
    stats.questionsSeen.set(q.qIndex, (stats.questionsSeen.get(q.qIndex) || 0) + 1);
    if (q.answered) return;
    seen.questions++;
    questionDone = false;
    const thinkMs = FAST ? rand(50, 400) : rand(300, Math.max(400, q.durationMs - 600));
    const answerDelay = behaviour === "late" ? q.durationMs + 150 : thinkMs;
    await sleep(answerDelay);
    if (questionDone && behaviour !== "late") return;
    const pos = Math.floor(Math.random() * q.options.length);
    const t0 = performance.now();
    const res = await emitWithAck(socket, "player:answer", { qIndex: q.qIndex, pos });
    stats.ackMs.push(performance.now() - t0);
    if (res?.accepted) stats.accepted++;
    else stats.rejected[res?.reason || "unknown"] = (stats.rejected[res?.reason || "unknown"] || 0) + 1;
    if (behaviour === "duplicate") {
      const again = await emitWithAck(socket, "player:answer", { qIndex: q.qIndex, pos });
      if (again?.accepted) stats.errors.push(`${name}: duplicate answer was accepted`);
      else stats.rejected[again?.reason || "unknown"] = (stats.rejected[again?.reason || "unknown"] || 0) + 1;
    }
    if (behaviour === "reconnect" && q.qIndex === 0) {
      socket.disconnect();
      await sleep(400);
      socket.connect();
      await new Promise((resolve) => socket.once("connect", resolve));
      const res2 = await emitWithAck(socket, "player:resume", { code, token });
      if (res2?.ok) stats.reconnects++;
      else stats.errors.push(`${name}: resume failed ${JSON.stringify(res2)}`);
    }
  });
  socket.on("question:reveal", (r) => {
    questionDone = true;
    seen.reveals++;
    stats.revealsSeen.set(r.qIndex, (stats.revealsSeen.get(r.qIndex) || 0) + 1);
  });

  await new Promise((resolve) => socket.on("connect", resolve));
  const t0 = performance.now();
  const joined = await emitWithAck(socket, "player:join", { code, name });
  stats.joinMs.push(performance.now() - t0);
  if (!joined?.ok) {
    stats.errors.push(`${name}: join failed ${JSON.stringify(joined)}`);
    return null;
  }
  token = joined.token;
  return { socket, name, seen };
}

async function main() {
  if (JOIN_CODE) return joinExistingRoom();
  console.log(`AptiQuiz load test: ${PLAYERS} players against ${URL} using set ${SET_ID} (practice room, not counted in the league)`);
  const { host, code, hostToken } = await runHost();
  console.log(`Room ${code} created`);

  const behaviours = (i) => (i === 1 ? "duplicate" : i === 2 ? "late" : i === 3 ? "reconnect" : "normal");
  const players = (await Promise.all(Array.from({ length: PLAYERS }, (_, i) => spawnPlayer(i, code, behaviours(i))))).filter(Boolean);
  console.log(`${players.length} players joined. Join latency p50 ${percentile(stats.joinMs, 50)} ms, p95 ${percentile(stats.joinMs, 95)} ms`);

  const finished = new Promise((resolve) => host.on("game:end", resolve));
  let questionsStarted = 0;
  host.on("question:start", () => {
    questionsStarted++;
  });
  host.on("question:reveal", async () => {
    await sleep(FAST ? 300 : 1500);
    await emitWithAck(host, "host:next", { code, hostToken });
  });

  const started = await emitWithAck(host, "host:start", { code, hostToken });
  if (!started?.ok) throw new Error(`host:start failed: ${JSON.stringify(started)}`);
  const t0 = performance.now();
  const end = await finished;
  const totalS = ((performance.now() - t0) / 1000).toFixed(1);

  const board = end.leaderboard;
  const sumScores = board.reduce((s, p) => s + p.score, 0);
  const scoreOrderOk = board.every((p, i) => i === 0 || board[i - 1].score >= p.score);
  const missing = [];
  for (let q = 0; q < questionsStarted; q++) {
    const seenQ = stats.questionsSeen.get(q) || 0;
    const seenR = stats.revealsSeen.get(q) || 0;
    if (seenQ < players.length) missing.push(`question ${q + 1}: ${players.length - seenQ} players never received it`);
    if (seenR < players.length) missing.push(`reveal ${q + 1}: ${players.length - seenR} players never received it`);
  }

  console.log("");
  console.log("Results");
  console.log(`  questions played: ${questionsStarted} in ${totalS} s`);
  console.log(`  answers accepted: ${stats.accepted}`);
  console.log(`  answers rejected: ${JSON.stringify(stats.rejected)}`);
  console.log(`  answer ack latency: p50 ${percentile(stats.ackMs, 50)} ms, p95 ${percentile(stats.ackMs, 95)} ms, max ${percentile(stats.ackMs, 100)} ms`);
  console.log(`  reconnects completed: ${stats.reconnects}`);
  console.log(`  leaderboard entries: ${board.length}, total points: ${sumScores}, sorted correctly: ${scoreOrderOk}`);
  console.log(`  fairness: avg RTT ${end.insights.fairness.avgRttMs} ms, max RTT ${end.insights.fairness.maxRttMs} ms, cap ${end.insights.fairness.rttCapMs} ms (measured by the server, subtracted from answer times)`);
  if (missing.length) console.log(`  delivery gaps:\n    ${missing.join("\n    ")}`);
  if (stats.errors.length) console.log(`  errors:\n    ${stats.errors.join("\n    ")}`);

  const ok = stats.errors.length === 0 && missing.length === 0 && scoreOrderOk && board.length === players.length && stats.rejected.duplicate >= 1 && stats.rejected.late >= 1;
  console.log("");
  console.log(ok ? "PASS: every player got every question and reveal, duplicates and late answers were rejected, leaderboard is consistent." : "FAIL: see details above.");

  for (const p of players) p.socket.disconnect();
  host.disconnect();
  process.exit(ok ? 0 : 1);
}

async function joinExistingRoom() {
  console.log(`AptiQuiz demo: ${PLAYERS} simulated players joining room ${JOIN_CODE} on ${URL}`);
  const behaviours = (i) => (i === 1 ? "duplicate" : i === 2 ? "late" : i === 3 ? "reconnect" : "normal");
  const players = (await Promise.all(Array.from({ length: PLAYERS }, (_, i) => spawnPlayer(i, JOIN_CODE, behaviours(i))))).filter(Boolean);
  if (!players.length) {
    let reason = "";
    try {
      reason = JSON.parse((stats.errors[0] || "").replace(/^[^:]*: join failed /, "")).error || "";
    } catch {
      reason = "";
    }
    console.log(`Nobody could join room ${JOIN_CODE}. ${reason ? `Server said: ${reason}. ` : ""}Host a room on the big screen first, then pass its 6-letter code with --join=CODE.`);
    process.exit(1);
  }
  console.log(`${players.length} players in the lobby. Join latency p50 ${percentile(stats.joinMs, 50)} ms, p95 ${percentile(stats.joinMs, 95)} ms`);
  console.log("Press Start on the host screen. The bots answer by themselves and this script reports when the game ends.");
  const ended = await new Promise((resolve) => players[0].socket.on("game:end", resolve));
  const questions = stats.questionsSeen.size;
  console.log("");
  console.log("Results");
  console.log(`  questions played: ${questions}`);
  console.log(`  answers accepted: ${stats.accepted}`);
  console.log(`  answers rejected: ${JSON.stringify(stats.rejected)}`);
  console.log(`  answer ack latency: p50 ${percentile(stats.ackMs, 50)} ms, p95 ${percentile(stats.ackMs, 95)} ms, max ${percentile(stats.ackMs, 100)} ms`);
  console.log(`  reconnects completed: ${stats.reconnects}`);
  console.log(`  final top 3: ${ended.top.slice(0, 3).map((p) => `${p.name} ${p.score}`).join(", ")}`);
  if (stats.errors.length) console.log(`  errors:\n    ${stats.errors.join("\n    ")}`);
  await sleep(500);
  for (const p of players) p.socket.disconnect();
  process.exit(stats.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
