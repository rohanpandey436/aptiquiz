export function PetDog({ className = "" }) {
  return (
    <svg viewBox="0 0 240 200" className={className} role="img" aria-label="A sleepy puppy holding an unplugged cable">
      <defs>
        <linearGradient id="pet-fur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path d="M28 160 C 70 150, 170 150, 212 160" stroke="#cbd5e1" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="6 8" />
      <path d="M208 160 c 14 0 14 -18 0 -18 c -12 0 -14 10 -8 14" stroke="#64748b" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="196" y="148" width="18" height="12" rx="3" fill="#64748b" />
      <rect x="214" y="150" width="5" height="3" fill="#64748b" />
      <rect x="214" y="156" width="5" height="3" fill="#64748b" />
      <ellipse cx="110" cy="172" rx="62" ry="10" fill="#0f172a" opacity="0.08" />
      <path d="M62 150 c 0 -34 20 -52 48 -52 s 48 18 48 52 c 0 10 -8 18 -18 18 h -60 c -10 0 -18 -8 -18 -18 z" fill="url(#pet-fur)" />
      <circle cx="110" cy="84" r="46" fill="url(#pet-fur)" />
      <path d="M70 70 c -20 -8 -34 14 -26 38 c 4 12 18 14 26 2 z" fill="#d97706" />
      <path d="M150 70 c 20 -8 34 14 26 38 c -4 12 -18 14 -26 2 z" fill="#d97706" />
      <path d="M84 92 q 8 -8 16 0" stroke="#0f172a" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M120 92 q 8 -8 16 0" stroke="#0f172a" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="110" cy="108" rx="10" ry="7" fill="#0f172a" />
      <path d="M110 115 v 8 m 0 0 q -10 10 -18 2 m 18 -2 q 10 10 18 2" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M104 124 c 4 10 12 10 16 0" fill="#f87171" />
      <circle cx="84" cy="112" r="6" fill="#fb7185" opacity="0.5" />
      <circle cx="136" cy="112" r="6" fill="#fb7185" opacity="0.5" />
      <path d="M150 140 c 18 -4 30 -16 32 -30" stroke="#d97706" strokeWidth="10" fill="none" strokeLinecap="round" />
      <g>
        <text x="178" y="66" fontFamily="Inter, sans-serif" fontSize="16" fontWeight="700" fill="#64748b">
          z
        </text>
        <text x="190" y="50" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="700" fill="#94a3b8">
          z
        </text>
      </g>
    </svg>
  );
}

const COPY = {
  offline: {
    title: "The internet went for a walk.",
    text: "Your seat and score are safe on the server. The moment your connection is back, you'll be right where you left off.",
  },
  reconnecting: {
    title: "The server is taking a nap.",
    text: "We're knocking on its door. Your seat and score are safe, and a refresh will bring you straight back into the game.",
  },
  crashed: {
    title: "Something tripped over a cable.",
    text: "This screen hit a snag. Your game and score are safe on the server. Reload to pick up where you were.",
  },
};

export function NetworkPet({ mode = "offline", onRetry, retryLabel = "Try again", children }) {
  const copy = COPY[mode] || COPY.offline;
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-canvas/95 px-6 text-center backdrop-blur">
      <PetDog className="w-56 max-w-[70vw]" />
      <h2 className="display text-3xl font-extrabold text-ink">{copy.title}</h2>
      <p className="max-w-md text-muted">{copy.text}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="press rounded-full bg-brand-700 px-6 py-3 font-semibold text-white shadow-[0_10px_22px_-10px_rgba(29,78,216,0.65)] hover:bg-brand-800"
        >
          {retryLabel}
        </button>
      ) : null}
      {children}
    </div>
  );
}
