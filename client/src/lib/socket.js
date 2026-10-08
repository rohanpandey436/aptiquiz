import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export const socket = io({ autoConnect: true, transports: ["websocket", "polling"] });

socket.on("rtt:probe", (ack) => {
  if (typeof ack === "function") ack();
});

export function request(event, payload = {}, timeoutMs = 8000) {
  return new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(event, payload, (err, res) => {
      if (err) resolve({ ok: false, accepted: false, reason: "timeout", error: "No reply from the server. Check your connection and try again." });
      else resolve(res ?? { ok: false, error: "Empty reply" });
    });
  });
}

export function useConnection() {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const up = () => setConnected(true);
    const down = () => setConnected(false);
    socket.on("connect", up);
    socket.on("disconnect", down);
    return () => {
      socket.off("connect", up);
      socket.off("disconnect", down);
    };
  }, []);
  return connected;
}

export function useSocketEvents(handlers, deps = []) {
  useEffect(() => {
    const entries = Object.entries(handlers);
    for (const [event, fn] of entries) socket.on(event, fn);
    return () => {
      for (const [event, fn] of entries) socket.off(event, fn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
