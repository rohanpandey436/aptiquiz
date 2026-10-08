const buttonStyles = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-200 disabled:text-white",
  secondary: "bg-white text-ink border border-line hover:bg-surface disabled:text-muted",
  ghost: "bg-transparent text-brand-700 hover:bg-brand-50 disabled:text-muted",
  danger: "bg-white text-bad border border-bad/30 hover:bg-bad-bg disabled:text-muted",
};

const buttonSizes = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2.5 text-base rounded-xl",
  lg: "px-6 py-3.5 text-lg rounded-2xl",
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed ${buttonStyles[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = "", children, as: Tag = "div", ...props }) {
  return (
    <Tag className={`rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`} {...props}>
      {children}
    </Tag>
  );
}

const badgeTones = {
  neutral: "bg-surface text-muted border-line",
  brand: "bg-brand-50 text-brand-800 border-brand-100",
  good: "bg-good-bg text-good border-transparent",
  bad: "bg-bad-bg text-bad border-transparent",
  warm: "bg-warm-bg text-warm border-transparent",
};

export function Badge({ tone = "neutral", className = "", children }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeTones[tone]} ${className}`}>{children}</span>;
}

export function Field({ id, label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-muted/70 focus:border-brand-600";

export function Banner({ tone = "neutral", children, className = "" }) {
  const tones = {
    neutral: "bg-surface text-ink border-line",
    bad: "bg-bad-bg text-bad border-transparent",
    good: "bg-good-bg text-good border-transparent",
    warm: "bg-warm-bg text-warm border-transparent",
  };
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-medium ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div className="flex items-center gap-3 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand-700" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Stat({ label, value, sub, tone = "neutral" }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "brand" ? "text-brand-700" : "text-ink";
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold tabular ${color}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}
