import { LETTERS, OPTION_COLORS } from "../lib/format.js";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function OptionTile({ index, text, state = "idle", count, total, onClick, disabled, size = "md" }) {
  const letter = LETTERS[index] || String(index + 1);
  const color = OPTION_COLORS[index] || "bg-opt-a";
  const interactive = typeof onClick === "function" && !disabled;
  const pad = size === "lg" ? "p-5 min-h-24 text-xl" : "p-4 min-h-18 text-base";
  const base = "relative flex w-full items-center gap-3 rounded-2xl border-2 text-left font-semibold transition-all";
  const styles = {
    idle: `${color} border-transparent text-white ${interactive ? "hover:brightness-110 active:scale-[0.99]" : ""}`,
    selected: `${color} border-ink text-white ring-4 ring-ink/15`,
    correct: "bg-good-bg border-good text-good",
    wrong: "bg-bad-bg border-bad text-bad",
    dim: "bg-surface border-line text-muted",
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
      className={`${base} ${pad} ${styles[state]} ${disabled && state === "idle" ? "opacity-80" : ""}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-extrabold ${
          state === "idle" || state === "selected" ? "bg-white/20" : state === "dim" ? "bg-white text-muted" : "bg-white"
        }`}
        aria-hidden="true"
      >
        {letter}
      </span>
      <span className="flex-1 leading-snug">{text}</span>
      {state === "correct" ? <CheckIcon /> : null}
      {state === "wrong" ? <CrossIcon /> : null}
      {showCounts ? (
        <span className="ml-2 shrink-0 text-sm font-bold tabular" aria-label={`${count} answers`}>
          {count}
        </span>
      ) : null}
      {showCounts ? (
        <span className="absolute inset-x-3 bottom-1.5 h-1.5 overflow-hidden rounded-full bg-black/10" aria-hidden="true">
          <span className="block h-full rounded-full bg-current" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </Tag>
  );
}
