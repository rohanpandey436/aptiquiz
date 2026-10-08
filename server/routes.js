import crypto from "node:crypto";
import { Router } from "express";
import * as store from "./store.js";
import { cleanCode, cleanId, cleanInt } from "./validate.js";

const HOST_PASSCODE = process.env.HOST_PASSCODE || "faculty";

function keyMatches(provided) {
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(HOST_PASSCODE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireHostKey(req, res, next) {
  if (keyMatches(req.get("x-host-key"))) return next();
  res.status(401).json({ error: "Host passcode required" });
}

export function createRouter(game) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, rooms: game.rooms.size, uptimeSeconds: Math.round(process.uptime()) });
  });

  router.post("/host/verify", (req, res) => {
    res.json({ ok: keyMatches(req.body?.passcode) });
  });

  router.get("/sets", (_req, res) => {
    res.json(store.listSets());
  });

  router.get("/sets/:id", requireHostKey, (req, res) => {
    const set = store.getSet(cleanId(req.params.id));
    if (!set) return res.status(404).json({ error: "Set not found" });
    res.json(set);
  });

  router.post("/sets", requireHostKey, (req, res) => {
    const result = store.saveSet(req.body || {});
    if (!result.ok) return res.status(400).json({ errors: result.errors });
    res.json(result.set);
  });

  router.post("/sets/:id/duplicate", requireHostKey, (req, res) => {
    const copy = store.duplicateSet(cleanId(req.params.id));
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
