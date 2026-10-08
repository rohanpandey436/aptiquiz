import { performance } from "node:perf_hooks";
import { cleanName, cleanCode, cleanCollege, cleanToken, cleanInt, cleanId, createRateLimiter } from "./validate.js";

const PROBE_INTERVAL_MS = 4000;
const PROBE_TIMEOUT_MS = 3000;

export function attachSockets(io, game) {
  const limiter = createRateLimiter(Number(process.env.RATE_LIMIT_PER_SEC) || 20);

  io.on("connection", (socket) => {
    socket.use((_packet, next) => {
      if (!limiter.allow(socket.id)) return next(new Error("rate_limited"));
      next();
    });
    socket.on("error", () => {});

    const reply = (ack, data) => {
      if (typeof ack === "function") ack(data);
    };

    const probe = () => {
      const sentAt = performance.now();
      socket.timeout(PROBE_TIMEOUT_MS).emit("rtt:probe", (err) => {
        if (!err) game.recordRtt(socket.id, performance.now() - sentAt);
      });
    };
    const probeTimer = setInterval(probe, PROBE_INTERVAL_MS);

    const hostRoom = (payload) => {
      const room = game.getRoom(cleanCode(payload?.code));
      if (!room) return { error: "Room not found" };
      if (room.hostToken !== cleanToken(payload?.hostToken)) return { error: "You are not the host of this room" };
      return { room };
    };

    const playerRef = () => {
      const ref = game.bySocket.get(socket.id);
      if (!ref || ref.role !== "player") return null;
      const room = game.rooms.get(ref.code);
      const player = room?.players.get(ref.playerId);
      return room && player ? { room, player } : null;
    };

    socket.on("host:create", (payload, ack) => {
      const setId = cleanId(payload?.setId);
      if (!setId) return reply(ack, { ok: false, error: "Pick a question set" });
      const result = game.createRoom({
        college: cleanCollege(payload?.college) || "Lloyd Institute",
        setId,
        questionTime: cleanInt(payload?.questionTime, 5, 120, 0),
        examMode: !!payload?.examMode,
      });
      if (result.error) return reply(ack, { ok: false, error: result.error });
      game.attachHost(result.room, socket);
      reply(ack, { ok: true, code: result.room.code, hostToken: result.room.hostToken, state: game.statePayloadForHost(result.room) });
    });

    socket.on("host:resume", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      game.attachHost(room, socket);
      reply(ack, { ok: true, code: room.code, state: game.statePayloadForHost(room) });
    });

    socket.on("host:start", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      const result = game.startGame(room);
      reply(ack, result.error ? { ok: false, error: result.error } : { ok: true });
    });

    socket.on("host:next", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      const result = game.nextQuestion(room);
      reply(ack, result.error ? { ok: false, error: result.error } : { ok: true });
    });

    socket.on("host:end", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      game.endGame(room);
      reply(ack, { ok: true });
    });

    socket.on("host:kick", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      reply(ack, { ok: game.kickPlayer(room, cleanId(payload?.playerId)) });
    });

    socket.on("spectator:join", (payload, ack) => {
      const room = game.getRoom(cleanCode(payload?.code));
      if (!room) return reply(ack, { ok: false, error: "Room not found" });
      game.attachSpectator(room, socket);
      reply(ack, { ok: true, code: room.code, state: game.statePayloadForHost(room) });
    });

    socket.on("player:join", (payload, ack) => {
      const code = cleanCode(payload?.code);
      const name = cleanName(payload?.name);
      if (!code) return reply(ack, { ok: false, error: "Enter the 6-letter room code" });
      if (!name) return reply(ack, { ok: false, error: "Enter a name" });
      const room = game.getRoom(code);
      if (!room) return reply(ack, { ok: false, error: "No room with that code. Check it with your host." });
      const result = game.joinPlayer(room, socket, name);
      if (result.error) return reply(ack, { ok: false, error: result.error });
      probe();
      reply(ack, { ok: true, playerId: result.player.id, token: result.player.token, name: result.player.name, state: game.statePayloadForPlayer(room, result.player) });
    });

    socket.on("player:resume", (payload, ack) => {
      const code = cleanCode(payload?.code);
      const token = cleanToken(payload?.token);
      const room = code ? game.getRoom(code) : null;
      if (!room || !token) return reply(ack, { ok: false, error: "Room not found" });
      const result = game.resumePlayer(room, socket, token);
      if (result.error) return reply(ack, { ok: false, error: result.error });
      probe();
      reply(ack, { ok: true, playerId: result.player.id, name: result.player.name, state: game.statePayloadForPlayer(room, result.player) });
    });

    socket.on("player:answer", (payload, ack) => {
      const ref = playerRef();
      if (!ref) return reply(ack, { accepted: false, reason: "not_in_room" });
      const qIndex = cleanInt(payload?.qIndex, 0, 10000, -1);
      const pos = cleanInt(payload?.pos, 0, 10, -1);
      reply(ack, game.submitAnswer(ref.room, ref.player, qIndex, pos));
    });

    socket.on("player:visibility", (payload) => {
      game.recordVisibility(socket.id, !!payload?.hidden);
    });

    socket.on("disconnect", () => {
      clearInterval(probeTimer);
      limiter.forget(socket.id);
      game.handleDisconnect(socket.id);
    });
  });
}
