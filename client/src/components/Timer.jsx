import { useEffect, useState } from "react";

export function Timer({ endsAt, durationMs, label = "Time left", size = "md" }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - Date.now()));

  useEffect(() => {
    setRemaining(Math.max(0, endsAt - Date.now()));
    const id = setInterval(() => {
      const left = Math.max(0, endsAt - Date.now());
      setRemaining(left);
      if (left <= 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [endsAt]);

  const frac = durationMs > 0 ? Math.min(1, remaining / durationMs) : 0;
  const urgent = remaining > 0 && remaining <= 5000;
  const secondsLeft = Math.ceil(remaining / 1000);
  const digits = size === "lg" ? "text-5xl" : "text-2xl";
  const track = size === "lg" ? "h-4" : "h-3";

  return (
    <div role="timer" aria-label={`${secondsLeft} seconds left`}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</span>
        <span className={`inline-block font-extrabold tabular ${digits} ${urgent ? "animate-pulse-soft text-bad" : "text-ink"}`}>{secondsLeft}s</span>
      </div>
      <div className={`${track} w-full overflow-hidden rounded-full bg-line`} aria-hidden="true">
        <div className={`h-full rounded-full ${urgent ? "bg-bad" : "bg-brand-gradient"}`} style={{ width: `${frac * 100}%`, transition: "width 100ms linear" }} />
      </div>
    </div>
  );
}
