import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useConnection } from "../lib/socket.js";
import { useTheme } from "../lib/theme.js";
import { useOnline } from "../lib/network.js";
import { NetworkPet } from "./NetworkPet.jsx";

const LONG_DISCONNECT_MS = 8000;

export function Logo({ className = "" }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-extrabold tracking-tight text-ink ${className}`} aria-label="AptiQuiz home">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#1d4ed8" />
        <path d="M20 40 L32 16 L44 40" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M25 32 H39" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <span className="display text-xl font-bold">AptiQuiz</span>
    </Link>
  );
}

const navClass = ({ isActive }) => `press rounded-full px-3 py-1.5 text-sm font-bold ${isActive ? "bg-brand-50 text-brand-ink" : "text-muted hover:text-ink"}`;

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      className="press ml-1 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink hover:bg-surface"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function Shell({ children, wide = false, nav = true, full = false, sticky = true }) {
  const connected = useConnection();
  const online = useOnline();
  const [longGone, setLongGone] = useState(false);
  useEffect(() => {
    if (connected) {
      setLongGone(false);
      return undefined;
    }
    const id = setTimeout(() => setLongGone(true), LONG_DISCONNECT_MS);
    return () => clearTimeout(id);
  }, [connected]);
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {!online ? <NetworkPet mode="offline" /> : null}
      {online && !connected && longGone ? <NetworkPet mode="reconnecting" onRetry={() => window.location.reload()} retryLabel="Refresh" /> : null}
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className={`${sticky ? "sticky top-0 z-20" : ""} border-b border-line bg-canvas/90 backdrop-blur`}>
        <div className={`mx-auto flex items-center justify-between px-4 py-3 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>
          <Logo />
          <div className="flex items-center gap-1">
            {nav ? (
              <nav aria-label="Main" className="flex items-center gap-1">
                <NavLink to="/host" className={navClass}>
                  Host
                </NavLink>
                <NavLink to="/play" className={navClass}>
                  Join
                </NavLink>
                <NavLink to="/practice" className={({ isActive }) => `hidden sm:inline-flex ${navClass({ isActive })}`}>
                  Practice
                </NavLink>
                <NavLink to="/league" className={navClass}>
                  League
                </NavLink>
                <NavLink to="/sets" className={({ isActive }) => `hidden md:inline-flex ${navClass({ isActive })}`}>
                  Questions
                </NavLink>
              </nav>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {!online ? (
        <div role="status" className="bg-bad-bg px-4 py-2 text-center text-sm font-bold text-bad-ink">
          You're offline. Your seat and score are safe on the server; we'll reconnect as soon as you're back.
        </div>
      ) : !connected ? (
        <div role="status" className="bg-warm-bg px-4 py-2 text-center text-sm font-bold text-warm">
          Reconnecting to the game server. Your score is safe.
        </div>
      ) : null}
      <main id="main" className={full ? "w-full flex-1" : `mx-auto w-full flex-1 px-4 py-6 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>
        {children}
      </main>
      <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
        Everyone in a room is a real person. There are no AI players and no AI answers.
      </footer>
    </div>
  );
}
