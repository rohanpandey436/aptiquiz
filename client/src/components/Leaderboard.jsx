import { AnimatePresence, motion } from "framer-motion";
import { signed } from "../lib/format.js";

function Movement({ delta }) {
  if (!delta) return <span className="w-8 shrink-0" aria-hidden="true" />;
  const up = delta > 0;
  return (
    <span className={`w-8 shrink-0 text-center text-xs font-extrabold ${up ? "text-good" : "text-bad"}`} aria-label={up ? `climbed ${delta}` : `dropped ${-delta}`}>
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

const rankChip = (rank) => {
  if (rank === 1) return "bg-accent text-ink";
  if (rank === 2) return "bg-ink text-white";
  if (rank === 3) return "bg-muted text-white";
  return "bg-surface-2 text-ink";
};

export function Leaderboard({ entries, highlightId, limit = 10, showDelta = true, showLast = true, dense = false }) {
  const rows = entries.slice(0, limit);
  return (
    <ol className="flex flex-col gap-2" aria-label="Leaderboard">
      <AnimatePresence initial={false}>
        {rows.map((e) => {
          const me = e.id === highlightId;
          const tone = me ? "border-brand-200 bg-brand-50 border-l-4 border-l-brand-700" : e.rank === 1 ? "border-accent/40 bg-accent-soft/60 border-l-4 border-l-accent" : "border-line bg-white";
          return (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className={`flex items-center gap-2 rounded-xl border pl-3 pr-2 sm:gap-3 sm:px-3 ${dense ? "py-2" : "py-3"} ${tone} ${e.connected === false ? "opacity-60" : ""}`}
            >
              <span className={`display flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular ${rankChip(e.rank)}`}>{e.rank}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {e.name}
                {me ? <span className="ml-1.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-700">you</span> : null}
              </span>
              {showDelta ? <Movement delta={e.delta} /> : null}
              {showLast && e.lastPoints ? (
                <span className={`hidden w-14 text-right text-sm font-bold tabular sm:inline-block ${e.lastPoints > 0 ? "text-good" : "text-bad"}`}>{signed(e.lastPoints)}</span>
              ) : showLast ? (
                <span className="hidden w-14 sm:inline-block" />
              ) : null}
              <span className="min-w-[3.5ch] text-right text-base font-extrabold tabular">{e.score}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
