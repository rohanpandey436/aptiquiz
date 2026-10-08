const buttonStyles = {
  primary:
    "bg-brand-700 text-white shadow-[0_10px_22px_-10px_rgba(29,78,216,0.65)] hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-[0_14px_26px_-10px_rgba(29,78,216,0.7)] active:translate-y-0 active:shadow-none disabled:bg-brand-200 disabled:shadow-none disabled:hover:translate-y-0",
  accent:
    "bg-accent text-ink shadow-[0_10px_22px_-10px_rgba(245,158,11,0.75)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_14px_26px_-10px_rgba(245,158,11,0.8)] active:translate-y-0 active:shadow-none disabled:bg-accent-soft disabled:text-muted disabled:shadow-none disabled:hover:translate-y-0",
  secondary: "bg-white text-ink ring-1 ring-inset ring-line shadow-sm hover:bg-surface hover:ring-brand-200 active:bg-surface-2 disabled:text-muted disabled:shadow-none",
  ghost: "bg-transparent text-brand-700 hover:bg-brand-50 disabled:text-muted",
  danger: "bg-white text-bad ring-1 ring-inset ring-bad/30 hover:bg-bad-bg disabled:text-muted",
  white: "bg-white text-brand-800 shadow-[0_10px_22px_-10px_rgba(15,23,42,0.45)] hover:-translate-y-0.5 hover:bg-brand-50 active:translate-y-0 active:shadow-none",
};

const buttonSizes = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2.5 text-[15px]",
  lg: "px-7 py-3.5 text-base",
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`press inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[0.01em] disabled:cursor-not-allowed ${buttonStyles[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = "", children, as: Tag = "div", ...props }) {
  return (
    <Tag className={`rounded-2xl border border-line bg-white p-5 shadow-card md:rounded-card ${className}`} {...props}>
      {children}
    </Tag>
  );
}

const badgeTones = {
  neutral: "bg-surface-2 text-muted border-transparent",
  brand: "bg-brand-50 text-brand-800 border-brand-100",
  good: "bg-good-bg text-good border-transparent",
  bad: "bg-bad-bg text-bad border-transparent",
  warm: "bg-warm-bg text-warm border-transparent",
  accent: "bg-accent text-ink border-transparent",
  white: "bg-white/15 text-white border-white/30",
};

export function Badge({ tone = "neutral", className = "", children }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeTones[tone]} ${className}`}>{children}</span>;
}

export function Field({ id, label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-tile border-2 border-line bg-white px-4 py-3 text-base text-ink placeholder:text-muted/60 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100";

export function Banner({ tone = "neutral", children, className = "" }) {
  const tones = {
    neutral: "bg-surface text-ink border-line",
    bad: "bg-bad-bg text-bad border-bad/20",
    good: "bg-good-bg text-good border-good/20",
    warm: "bg-warm-bg text-warm border-accent/40",
  };
  return (
    <div role="status" className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div className="flex items-center gap-3 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand-700" aria-hidden="true" />
      <span className="font-semibold">{label}</span>
    </div>
  );
}

export function Stat({ label, value, sub, tone = "neutral", className = "" }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "brand" ? "text-brand-700" : "text-ink";
  return (
    <div className={`rounded-tile border border-line bg-white p-4 ${className}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={`display mt-1 text-2xl font-bold tabular ${color}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

export function Eyebrow({ children, tone = "brand", className = "" }) {
  const tones = {
    brand: "text-brand-800",
    white: "text-brand-100",
    muted: "text-muted",
  };
  return <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${tones[tone]} ${className}`}>{children}</p>;
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="inline-flex rounded-full bg-surface-2 p-1" role="tablist" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={`press rounded-full px-4 py-2 text-sm font-semibold ${value === key ? "bg-white text-ink shadow-sm ring-1 ring-inset ring-line" : "text-muted hover:text-ink"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
