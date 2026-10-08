import { useEffect, useState } from "react";

export const TIME_CHOICES = [
  { value: 0, label: "Set default" },
  { value: 10, label: "10 s" },
  { value: 15, label: "15 s" },
  { value: 20, label: "20 s" },
  { value: 30, label: "30 s" },
  { value: 45, label: "45 s" },
];

export function Toggle({ id, checked, onChange, title, text, compact = false }) {
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-start gap-3 rounded-tile border-2 border-line transition-colors hover:border-brand-200 ${compact ? "p-3" : "p-4"}`}>
      <input id={id} type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand-700" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </label>
  );
}

export function Countdown({ endsAt, prefix = "Next in", className = "" }) {
  return <LiveSeconds endsAt={endsAt} render={(s) => `${prefix} ${s}s`} className={className} />;
}


export function LiveSeconds({ endsAt, render, className = "" }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return (
    <span className={`tabular ${className}`} aria-live="polite">
      {render(left)}
    </span>
  );
}
