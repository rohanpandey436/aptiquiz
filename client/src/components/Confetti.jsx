const COLORS = ["bg-opt-a", "bg-accent", "bg-opt-c", "bg-opt-d", "bg-white"];

export function Confetti({ pieces = 14 }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: pieces }, (_, i) => (
        <span
          key={i}
          className={`confetti absolute top-0 h-2.5 w-2.5 animate-confetti rounded-sm ${COLORS[i % COLORS.length]}`}
          style={{ left: `${(i * 7) % 100}%`, "--dx": `${(i % 2 ? 1 : -1) * (10 + i * 4)}px`, animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}
