import { Router } from "express";
import * as store from "./store.js";
import { cleanCode, cleanId, cleanInt } from "./validate.js";
import { verifyHostKey, isBlocked, clientIp, editorLocked } from "./auth.js";

function requireHostKey(req, res, next) {
  const ip = clientIp(req);
  if (isBlocked(ip)) return res.status(429).json({ error: "Too many wrong passcodes. Try again in 15 minutes." });
  const result = verifyHostKey(req.get("x-host-key"), ip);
  if (result.ok) return next();
  res.status(result.blocked ? 429 : 401).json({ error: result.blocked ? "Too many wrong passcodes. Try again in 15 minutes." : "Host passcode required" });
}

export function createRouter(game) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, rooms: game.rooms.size, uptimeSeconds: Math.round(process.uptime()), editorLocked: editorLocked() });
  });

  router.get("/config", (_req, res) => {
    res.json({ editorLocked: editorLocked() });
  });

  router.post("/host/verify", (req, res) => {
    const ip = clientIp(req);
    if (isBlocked(ip)) return res.status(429).json({ ok: false, error: "Too many wrong passcodes. Try again in 15 minutes." });
    const result = verifyHostKey(req.body?.passcode, ip);
    res.json({ ok: result.ok });
  });

  router.get("/sets", (_req, res) => {
    res.json(store.listSets());
  });

  router.get("/sets/:id", requireHostKey, (req, res) => {
    const set = store.getSet(cleanId(req.params.id));
    if (!set) return res.status(404).json({ error: "Set not found" });
    if (game.setsInPlay().has(set.id)) return res.json(store.withoutAnswers(set));
    res.json({ ...set, locked: false });
  });

  router.post("/sets", requireHostKey, (req, res) => {
    const result = store.saveSet(req.body || {});
    if (!result.ok) return res.status(400).json({ errors: result.errors });
    res.json(result.set);
  });

  router.post("/sets/:id/duplicate", requireHostKey, (req, res) => {
    const id = cleanId(req.params.id);
    if (game.setsInPlay().has(id)) return res.status(409).json({ error: "This set is being played right now. Duplicate it after the game ends." });
    const copy = store.duplicateSet(id);
    if (!copy) return res.status(404).json({ error: "Set not found" });
    res.json(copy);
  });

  router.delete("/sets/:id", requireHostKey, (req, res) => {
    const removed = store.deleteSet(cleanId(req.params.id));
    if (!removed) return res.status(404).json({ error: "Set not found" });
    res.json({ ok: true });
  });

  router.get("/league", (req, res) => {
    const period = String(req.query.period || "all");
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 0;
    res.json({ period, ...store.league(days) });
  });

  router.get("/games/recent", (req, res) => {
    res.json(store.recentGames(cleanInt(req.query.limit, 1, 100, 20)));
  });

  router.get("/rooms/:code", (req, res) => {
    const room = game.getRoom(cleanCode(req.params.code));
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(game.publicRoomInfo(room));
  });

  router.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return router;
}

