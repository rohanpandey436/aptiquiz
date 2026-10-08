import { LETTERS, OPTION_COLORS } from "../lib/format.js";

function Tick() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-good-ink" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-bad-ink/70" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function AnswerChart({ options, counts, correct, total }) {
  const max = Math.max(1, ...counts);
  const answered = total || counts.reduce((a, b) => a + b, 0) || 1;
  return (
    <figure className="rounded-card border border-line bg-card p-5 shadow-card">
      <figcaption className="mb-4 flex items-baseline justify-between">
        <span className="display text-lg font-bold">Who picked what</span>
        <span className="text-sm text-muted">{answered} answered</span>
      </figcaption>
      <div className="grid items-end gap-4" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, height: "14rem" }} role="img" aria-label={`Answers per option: ${options.map((o, i) => `${LETTERS[i]} ${counts[i]}`).join(", ")}`}>
        {options.map((text, i) => {
          const isCorrect = i === correct;
          const pct = Math.round((100 * counts[i]) / max);
          return (
            <div key={i} className="flex h-full flex-col items-center justify-end gap-2">
              <span className="flex h-8 items-end" aria-hidden="true">
                {isCorrect ? <Tick /> : <Cross />}
              </span>
              <span className="text-lg font-extrabold tabular text-ink">{counts[i]}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className={`w-full origin-bottom animate-grow rounded-t-lg ${OPTION_COLORS[i] || "bg-opt-a"} ${isCorrect ? "" : "opacity-45"}`}
                  style={{ height: `${Math.max(4, pct)}%`, transformOrigin: "bottom", animationName: "grow-y" }}
                  title={`${LETTERS[i]}: ${counts[i]} ${counts[i] === 1 ? "answer" : "answers"}`}
                />
              </div>
              <span className={`display flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${isCorrect ? "bg-good text-white" : "bg-surface-2 text-ink"}`}>{LETTERS[i]}</span>
              <span className={`line-clamp-2 w-full text-center text-xs leading-tight ${isCorrect ? "font-bold text-ink" : "text-muted"}`}>{text}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
