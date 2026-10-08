import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { seedSets } from "./seed/questions.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(here, "..", process.env.DATA_DIR || "./data");
const SETS_FILE = path.join(DATA_DIR, "sets.json");
const GAMES_FILE = path.join(DATA_DIR, "games.json");

export const TOPICS = ["quantitative", "logical", "verbal", "data interpretation"];
export const DIFFICULTIES = ["easy", "medium", "hard"];

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export function newId(prefix = "") {
  return prefix + crypto.randomBytes(6).toString("base64url");
}

let sets = [];
let games = [];

export function init() {
  ensureDir();
  sets = readJson(SETS_FILE, null);
  if (!Array.isArray(sets) || sets.length === 0) {
    sets = seedSets();
    writeJson(SETS_FILE, sets);
  }
  games = readJson(GAMES_FILE, []);
  if (!Array.isArray(games)) games = [];
}

function summarize(set) {
  const topics = {};
  for (const q of set.questions) topics[q.topic] = (topics[q.topic] || 0) + 1;
  return {
    id: set.id,
    title: set.title,
    description: set.description || "",
    count: set.questions.length,
    questionTime: set.questionTime || 20,
    seed: !!set.seed,
    topics,
    updatedAt: set.updatedAt,
  };
}

export function listSets() {
  return sets.map(summarize);
}

export function getSet(id) {
  return sets.find((s) => s.id === id) || null;
}

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

export function validateQuestion(raw, index) {
  const errors = [];
  const q = {};
  q.id = cleanText(raw?.id, 40) || newId("q_");
  q.text = cleanText(raw?.text, 600);
  if (!q.text) errors.push(`Question ${index + 1}: text is required`);
  const options = Array.isArray(raw?.options) ? raw.options.map((o) => cleanText(o, 200)) : [];
  if (options.length < 2 || options.length > 6) errors.push(`Question ${index + 1}: needs 2 to 6 options`);
  if (options.some((o) => !o)) errors.push(`Question ${index + 1}: every option needs text`);
  q.options = options;
  q.correct = Number(raw?.correct);
  if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= options.length) {
    errors.push(`Question ${index + 1}: correct answer must point to one of the options`);
  }
  q.topic = TOPICS.includes(raw?.topic) ? raw.topic : "quantitative";
  q.difficulty = DIFFICULTIES.includes(raw?.difficulty) ? raw.difficulty : "medium";
  const image = cleanText(raw?.image, 500);
  q.image = /^https?:\/\//i.test(image) ? image : null;
  if (Array.isArray(raw?.table) && raw.table.length) {
    const rows = raw.table.slice(0, 10).map((r) => (Array.isArray(r) ? r.slice(0, 8).map((c) => cleanText(String(c ?? ""), 60)) : []));
    q.table = rows.filter((r) => r.length);
    if (!q.table.length) q.table = null;
  } else {
    q.table = null;
  }
  q.explanation = cleanText(raw?.explanation, 600) || "";
  const time = Number(raw?.time);
  q.time = Number.isInteger(time) && time >= 5 && time <= 120 ? time : null;
  return { q, errors };
}

export function saveSet(raw) {
  const errors = [];
  const title = cleanText(raw?.title, 80);
  if (!title) errors.push("Title is required");
  const questions = Array.isArray(raw?.questions) ? raw.questions : [];
  if (!questions.length) errors.push("Add at least one question");
  if (questions.length > 200) errors.push("A set can hold up to 200 questions");
  const cleaned = [];
  questions.forEach((rq, i) => {
    const { q, errors: qe } = validateQuestion(rq, i);
    errors.push(...qe);
    cleaned.push(q);
  });
  if (errors.length) return { ok: false, errors };
  const questionTime = Number(raw?.questionTime);
  const existing = raw?.id ? getSet(raw.id) : null;
  const set = {
    id: existing ? existing.id : newId("set_"),
    title,
    description: cleanText(raw?.description, 200),
    questionTime: Number.isInteger(questionTime) && questionTime >= 5 && questionTime <= 120 ? questionTime : 20,
    seed: existing ? !!existing.seed && !raw?.unseed : false,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: cleaned,
  };
  if (existing) sets = sets.map((s) => (s.id === set.id ? set : s));
  else sets.push(set);
  writeJson(SETS_FILE, sets);
  return { ok: true, set };
}

export function duplicateSet(id) {
  const src = getSet(id);
  if (!src) return null;
  const copy = {
    ...src,
    id: newId("set_"),
    title: `${src.title} (copy)`.slice(0, 80),
    seed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: src.questions.map((q) => ({ ...q, id: newId("q_") })),
  };
  sets.push(copy);
  writeJson(SETS_FILE, sets);
  return copy;
}

export function deleteSet(id) {
  const before = sets.length;
  sets = sets.filter((s) => s.id !== id);
  if (sets.length === before) return false;
  writeJson(SETS_FILE, sets);
  return true;
}

export function addGame(summary) {
  games.push(summary);
  if (games.length > 5000) games = games.slice(-5000);
  writeJson(GAMES_FILE, games);
}

export function league(periodDays) {
  const since = periodDays ? Date.now() - periodDays * 86400000 : 0;
  const recent = games.filter((g) => new Date(g.endedAt).getTime() >= since);
  const colleges = new Map();
  const players = new Map();
  for (const g of recent) {
    const c = colleges.get(g.college) || { college: g.college, games: 0, players: 0, totalPoints: 0, bestScore: 0, bestPlayer: "" };
    c.games += 1;
    for (const p of g.players) {
      c.players += 1;
      c.totalPoints += p.score;
      if (p.score > c.bestScore) {
        c.bestScore = p.score;
        c.bestPlayer = p.name;
      }
      const key = `${g.college}::${p.name.toLowerCase()}`;
      const entry = players.get(key) || { name: p.name, college: g.college, games: 0, totalPoints: 0, bestScore: 0, correct: 0, answered: 0 };
      entry.games += 1;
      entry.totalPoints += p.score;
      entry.bestScore = Math.max(entry.bestScore, p.score);
      entry.correct += p.correct;
      entry.answered += p.questions;
      players.set(key, entry);
    }
    colleges.set(g.college, c);
  }
  const collegeRows = [...colleges.values()]
    .map((c) => ({ ...c, avgPoints: c.players ? Math.round(c.totalPoints / c.players) : 0 }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 50);
  const playerRows = [...players.values()]
    .map((p) => ({ ...p, accuracy: p.answered ? Math.round((100 * p.correct) / p.answered) : 0 }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 50);
  return { games: recent.length, colleges: collegeRows, players: playerRows };
}

export function recentGames(limit = 20) {
  return games.slice(-limit).reverse();
}
