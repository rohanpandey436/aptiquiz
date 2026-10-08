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
  const textSize = size === "lg" ? "text-4xl" : "text-xl";

  return (
    <div role="timer" aria-label={`${secondsLeft} seconds left`}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-muted">{label}</span>
        <span className={`${textSize} font-extrabold tabular ${urgent ? "text-bad" : "text-ink"}`}>{secondsLeft}s</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div
          className={`h-full rounded-full ${urgent ? "bg-bad" : "bg-brand-600"}`}
          style={{ width: `${frac * 100}%`, transition: "width 100ms linear" }}
        />
      </div>
    </div>
  );
}
