import { useEffect, useState } from "react";

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function friendlyError(err) {
  if (!err) return "Something went wrong. Try again.";
  if (err.name === "TypeError" || /Failed to fetch|NetworkError|Load failed/i.test(err.message || "")) {
    return "Can't reach the server. Check your internet connection and try again.";
  }
  if (err.status === 502 || err.status === 503 || err.status === 504) return "The server is waking up. Try again in a few seconds.";
  if (err.status === 429) return err.message || "Too many attempts. Wait a moment and try again.";
  return err.message || "Something went wrong. Try again.";
}
