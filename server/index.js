import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import * as store from "./store.js";
import { GameManager } from "./game.js";
import { createRouter } from "./routes.js";
import { attachSockets } from "./sockets.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "..", "dist");
const PORT = Number(process.env.PORT) || 3000;

store.init();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.use(express.json({ limit: "200kb" }));

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 10_000,
  pingInterval: 10_000,
  pingTimeout: 8_000,
});
const game = new GameManager(io);
attachSockets(io, game);

app.use("/api", createRouter(game));

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: "1h", index: false }));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.status(503).send("Client not built. Run npm run build, or use npm run dev.");
  });
}

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception, shutting down for a clean restart", err);
  game.shutdown();
  setTimeout(() => process.exit(1), 200).unref();
});

const keepAliveUrl = process.env.KEEPALIVE_URL || (process.env.RENDER_EXTERNAL_URL ? `${process.env.RENDER_EXTERNAL_URL}/api/health` : "");
if (keepAliveUrl) {
  setInterval(() => fetch(keepAliveUrl).catch(() => {}), 10 * 60 * 1000).unref();
}

server.listen(PORT, () => {
  console.log(`AptiQuiz listening on http://localhost:${PORT}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    game.shutdown();
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
