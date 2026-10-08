import { Link, NavLink } from "react-router-dom";
import { useConnection } from "../lib/socket.js";

export function Logo({ className = "" }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-extrabold tracking-tight text-ink ${className}`} aria-label="AptiQuiz home">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#1d4ed8" />
        <path d="M20 40 L32 16 L44 40" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M25 32 H39" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <span className="text-lg">AptiQuiz</span>
    </Link>
  );
}

const navClass = ({ isActive }) => `rounded-lg px-2.5 py-1.5 text-sm font-semibold sm:px-3 ${isActive ? "bg-brand-50 text-brand-800" : "text-muted hover:text-ink"}`;

export function Shell({ children, wide = false, nav = true }) {
  const connected = useConnection();
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="border-b border-line">
        <div className={`mx-auto flex items-center justify-between px-4 py-3 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
          <Logo />
          {nav ? (
            <nav aria-label="Main" className="flex items-center gap-1">
              <NavLink to="/host" className={navClass}>
                Host
              </NavLink>
              <NavLink to="/play" className={navClass}>
                Join
              </NavLink>
              <NavLink to="/league" className={navClass}>
                League
              </NavLink>
              <NavLink to="/sets" className={({ isActive }) => `hidden sm:inline-flex ${navClass({ isActive })}`}>
                Questions
              </NavLink>
            </nav>
          ) : null}
        </div>
      </header>
      {!connected ? (
        <div role="status" className="bg-warm-bg px-4 py-2 text-center text-sm font-semibold text-warm">
          Reconnecting to the game server. Your score is safe.
        </div>
      ) : null}
      <main id="main" className={`mx-auto w-full flex-1 px-4 py-6 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
        {children}
      </main>
      <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
        Every player in a room is a real person. AptiQuiz has no AI players, AI chat or AI-generated answers.
      </footer>
    </div>
  );
}
