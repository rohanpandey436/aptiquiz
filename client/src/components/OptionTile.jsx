import { LETTERS, OPTION_COLORS } from "../lib/format.js";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function OptionTile({ index, text, state = "idle", count, total, onClick, disabled, size = "md", delay = 0 }) {
  const letter = LETTERS[index] || String(index + 1);
  const color = OPTION_COLORS[index] || "bg-opt-a";
  const interactive = typeof onClick === "function" && !disabled;
  const pad = size === "lg" ? "p-6 min-h-28 text-2xl" : "p-4 min-h-16 text-lg";
  const chip = size === "lg" ? "h-12 w-12 rounded-2xl text-xl" : "h-10 w-10 rounded-xl text-base";
  const base = "press relative flex w-full items-center gap-3 rounded-tile border-2 text-left font-bold animate-rise";
  const styles = {
    idle: `${color} border-transparent text-white shadow-[0_12px_24px_-14px_rgba(15,23,42,0.55)] ${interactive ? "hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_16px_28px_-14px_rgba(15,23,42,0.6)] active:translate-y-0 active:scale-[0.99] active:shadow-none" : ""} ${disabled ? "opacity-60 saturate-50" : ""}`,
    selected: `${color} border-ink text-white ring-4 ring-ink/15 shadow-none animate-pop`,
    correct: "bg-good border-good text-white animate-pop",
    wrong: "bg-bad-bg border-bad text-bad-ink",
    dim: "bg-surface-2 border-line text-muted",
  };
  const chipStyles = {
    idle: "bg-white/20 text-white",
    selected: "bg-white/20 text-white",
    correct: "bg-white text-good-ink",
    wrong: "bg-white text-bad-ink",
    dim: "bg-white text-muted",
  };
  const pct = total ? Math.round((100 * (count || 0)) / total) : 0;
  const showCounts = typeof count === "number";
  const Tag = interactive ? "button" : "div";

  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={interactive ? disabled : undefined}
      aria-pressed={interactive ? state === "selected" : undefined}
      aria-label={interactive ? `Option ${letter}: ${text}` : undefined}
      className={`${base} ${pad} ${styles[state]}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`flex shrink-0 items-center justify-center font-extrabold ${chip} ${chipStyles[state]}`} aria-hidden="true">
        {letter}
      </span>
      <span className="flex-1 leading-snug">{text}</span>
      {state === "correct" || state === "selected" ? <CheckIcon /> : null}
      {state === "wrong" ? <CrossIcon /> : null}
      {showCounts ? (
        <span className={`ml-1 shrink-0 rounded-full px-2 py-0.5 text-sm font-bold tabular ${state === "correct" ? "bg-white/90 text-ink" : "bg-white text-muted"}`} aria-label={`${count} answers`}>
          {count}
        </span>
      ) : null}
      {showCounts ? (
        <span className="absolute inset-x-4 bottom-2 h-1.5 overflow-hidden rounded-full bg-black/10" aria-hidden="true">
          <span className={`block h-full origin-left animate-grow rounded-full ${state === "correct" ? "bg-white/80" : "bg-muted/50"}`} style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </Tag>
  );
}
