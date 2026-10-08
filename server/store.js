import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { seedSets } from "./seed/questions.js";
import { validateSet } from "./validate.js";

const here = path.dirname(fileURLToPath(import.meta.url));

let dataDir = null;
let setsFile = null;
let gamesFile = null;
let sets = [];
let games = [];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export function newId(prefix = "") {
  return prefix + crypto.randomBytes(6).toString("base64url");
}

export function init(dir = process.env.DATA_DIR || "./data") {
  dataDir = path.resolve(here, "..", dir);
  setsFile = path.join(dataDir, "sets.json");
  gamesFile = path.join(dataDir, "games.json");
  fs.mkdirSync(dataDir, { recursive: true });
  sets = readJson(setsFile, null);
  if (!Array.isArray(sets) || sets.length === 0) {
    sets = seedSets();
    writeJson(setsFile, sets);
  }
  games = readJson(gamesFile, []);
  if (!Array.isArray(games)) games = [];
  return dataDir;
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

export function withoutAnswers(set) {
  return {
    ...set,
    locked: true,
    questions: set.questions.map(({ correct, explanation, ...rest }) => rest),
  };
}

export function saveSet(raw) {
  const { errors, set: cleaned } = validateSet(raw, newId);
  if (errors.length) return { ok: false, errors };
  const existing = cleaned.id ? getSet(cleaned.id) : null;
  const now = new Date().toISOString();
  const set = {
    ...cleaned,
    id: existing ? existing.id : newId("set_"),
    seed: existing ? !!existing.seed : false,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  if (existing) sets = sets.map((s) => (s.id === set.id ? set : s));
  else sets.push(set);
  writeJson(setsFile, sets);
  return { ok: true, set };
}

export function duplicateSet(id) {
  const src = getSet(id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy = {
    ...src,
    id: newId("set_"),
    title: `${src.title} (copy)`.slice(0, 80),
    seed: false,
    createdAt: now,
    updatedAt: now,
    questions: src.questions.map((q) => ({ ...q, id: newId("q_") })),
  };
  sets.push(copy);
  writeJson(setsFile, sets);
  return copy;
}

export function deleteSet(id) {
  const before = sets.length;
  sets = sets.filter((s) => s.id !== id);
  if (sets.length === before) return false;
  writeJson(setsFile, sets);
  return true;
}

export function addGame(summary) {
  games.push(summary);
  if (games.length > 5000) games = games.slice(-5000);
  writeJson(gamesFile, games);
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
      if (!c.bestPlayer || p.score > c.bestScore) {
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
