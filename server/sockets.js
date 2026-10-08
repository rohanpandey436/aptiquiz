import { performance } from "node:perf_hooks";
import { cleanName, cleanCode, cleanCollege, cleanToken, cleanInt, cleanId, createRateLimiter } from "./validate.js";
import { clientIp } from "./auth.js";

const PROBE_INTERVAL_MS = 4000;
const PROBE_TIMEOUT_MS = 3000;

export function attachSockets(io, game) {
  const limiter = createRateLimiter(Number(process.env.RATE_LIMIT_PER_SEC) || 20);

  io.on("connection", (socket) => {
    const ip = clientIp(socket.request);

    socket.use((_packet, next) => {
      if (!limiter.allow(socket.id)) return next(new Error("rate_limited"));
      next();
    });
    socket.on("error", () => {});

    const reply = (ack, data) => {
      if (typeof ack === "function") ack(data);
    };

    const on = (event, handler) => {
      socket.on(event, (payload, ack) => {
        try {
          handler(payload, ack);
        } catch (err) {
          console.error(`Error handling ${event}`, err);
          reply(ack, { ok: false, accepted: false, error: "Something went wrong on the server. Try again." });
        }
      });
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

    on("host:create", (payload, ack) => {
      const setId = cleanId(payload?.setId);
      if (!setId) return reply(ack, { ok: false, error: "Pick a question set" });
      const result = game.createRoom({
        college: cleanCollege(payload?.college) || "Lloyd Institute",
        setId,
        questionTime: cleanInt(payload?.questionTime, 5, 120, 0),
        examMode: !!payload?.examMode,
        autoAdvance: payload?.autoAdvance !== false,
        practice: !!payload?.practice,
        difficulty: typeof payload?.difficulty === "string" ? payload.difficulty : "mixed",
      });
      if (result.error) return reply(ack, { ok: false, error: result.error });
      game.attachHost(result.room, socket);
      reply(ack, { ok: true, code: result.room.code, hostToken: result.room.hostToken, state: game.statePayloadForHost(result.room) });
    });

    on("host:resume", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      game.attachHost(room, socket);
      reply(ack, { ok: true, code: room.code, state: game.statePayloadForHost(room) });
    });

    on("practice:start", (payload, ack) => {
      const setId = cleanId(payload?.setId);
      if (!setId) return reply(ack, { ok: false, error: "Pick a question set" });
      const name = cleanName(payload?.name) || "You";
      const result = game.createRoom({
        college: "Practice",
        setId,
        questionTime: cleanInt(payload?.questionTime, 5, 120, 0),
        examMode: false,
        autoAdvance: true,
        practice: true,
        difficulty: typeof payload?.difficulty === "string" ? payload.difficulty : "mixed",
      });
      if (result.error) return reply(ack, { ok: false, error: result.error });
      const joined = game.joinPlayer(result.room, socket, name, ip);
      if (joined.error) return reply(ack, { ok: false, error: joined.error });
      const started = game.startGame(result.room);
      if (started.error) return reply(ack, { ok: false, error: started.error });
      probe();
      reply(ack, { ok: true, code: result.room.code, playerId: joined.player.id, token: joined.player.token, name: joined.player.name });
    });

    on("host:update", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      const result = game.updateRoom(room, {
        setId: cleanId(payload?.setId),
        questionTime: cleanInt(payload?.questionTime, 5, 120, 0),
        examMode: typeof payload?.examMode === "boolean" ? payload.examMode : undefined,
        autoAdvance: typeof payload?.autoAdvance === "boolean" ? payload.autoAdvance : undefined,
        college: cleanCollege(payload?.college),
        difficulty: typeof payload?.difficulty === "string" ? payload.difficulty : undefined,
      });
      reply(ack, result.error ? { ok: false, error: result.error } : { ok: true });
    });

    on("host:auto", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      reply(ack, game.setAutoAdvance(room, !!payload?.enabled));
    });

    on("host:start", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      const result = game.startGame(room);
      reply(ack, result.error ? { ok: false, error: result.error } : { ok: true });
    });

    on("host:close", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      const result = game.closeRound(room);
      reply(ack, result.error ? { ok: false, error: result.error } : { ok: true });
    });

    on("host:next", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      const result = game.nextQuestion(room);
      reply(ack, result.error ? { ok: false, error: result.error } : { ok: true });
    });

    on("host:end", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      game.endGame(room);
      reply(ack, { ok: true });
    });

    on("host:kick", (payload, ack) => {
      const { room, error } = hostRoom(payload);
      if (error) return reply(ack, { ok: false, error });
      reply(ack, { ok: game.kickPlayer(room, cleanId(payload?.playerId)) });
    });

    on("spectator:join", (payload, ack) => {
      const room = game.getRoom(cleanCode(payload?.code));
      if (!room) return reply(ack, { ok: false, error: "Room not found" });
      game.attachSpectator(room, socket);
      reply(ack, { ok: true, code: room.code, state: game.statePayloadForSpectator(room) });
    });

    on("player:join", (payload, ack) => {
      const code = cleanCode(payload?.code);
      const name = cleanName(payload?.name);
      if (!code) return reply(ack, { ok: false, error: "Enter the 6-letter room code" });
      if (!name) return reply(ack, { ok: false, error: "Enter a name" });
      const room = game.getRoom(code);
      if (!room) return reply(ack, { ok: false, error: "No room with that code. Check it with your host." });
      const result = game.joinPlayer(room, socket, name, ip);
      if (result.error) return reply(ack, { ok: false, error: result.error });
      probe();
      reply(ack, { ok: true, playerId: result.player.id, token: result.player.token, name: result.player.name, state: game.statePayloadForPlayer(room, result.player) });
    });

    on("player:resume", (payload, ack) => {
      const code = cleanCode(payload?.code);
      const token = cleanToken(payload?.token);
      const room = code ? game.getRoom(code) : null;
      if (!room || !token) return reply(ack, { ok: false, reason: "rejected", error: "Room not found" });
      const result = game.resumePlayer(room, socket, token);
      if (result.error) return reply(ack, { ok: false, reason: "rejected", error: result.error });
      probe();
      reply(ack, { ok: true, playerId: result.player.id, name: result.player.name, state: game.statePayloadForPlayer(room, result.player) });
    });

    on("player:answer", (payload, ack) => {
      const ref = playerRef();
      if (!ref) return reply(ack, { accepted: false, reason: "not_in_room" });
      const qIndex = cleanInt(payload?.qIndex, 0, 10000, -1);
      const pos = cleanInt(payload?.pos, 0, 10, -1);
      reply(ack, game.submitAnswer(ref.room, ref.player, qIndex, pos));
    });

    on("player:end", (_payload, ack) => {
      const ref = playerRef();
      if (!ref) return reply(ack, { ok: false, error: "You are not in a room" });
      const result = game.endPractice(ref.room, ref.player);
      reply(ack, result.error ? { ok: false, error: result.error } : { ok: true });
    });

    on("player:visibility", (payload) => {
      game.recordVisibility(socket.id, !!payload?.hidden);
    });

    socket.on("disconnect", () => {
      clearInterval(probeTimer);
      limiter.forget(socket.id);
      game.handleDisconnect(socket.id);
    });
  });
}
