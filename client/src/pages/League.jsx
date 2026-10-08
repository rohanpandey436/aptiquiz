import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Shell } from "../components/Layout.jsx";
import { Banner, Button, Card, Segmented, Spinner, inputClass } from "../components/ui.jsx";
import { api } from "../lib/api.js";

const PERIODS = [
  ["7d", "This week"],
  ["30d", "This month"],
  ["all", "All time"],
];

const rankChip = (i) => (i === 0 ? "bg-accent text-ink" : i === 1 ? "bg-ink text-white" : i === 2 ? "bg-muted text-white" : "bg-surface-2 text-ink");

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export default function League() {
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    api
      .get(`/league?period=${period}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [period]);

  useEffect(() => {
    api
      .get("/games/recent?limit=8")
      .then(setRecent)
      .catch(() => setRecent([]));
  }, []);

  const q = query.trim().toLowerCase();
  const colleges = useMemo(() => (data ? data.colleges.filter((c) => !q || c.college.toLowerCase().includes(q)) : []), [data, q]);
  const players = useMemo(() => (data ? data.players.filter((p) => !q || p.college.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : []), [data, q]);

  return (
    <Shell full>
      <section className="mx-auto max-w-6xl px-4 pt-6 md:pt-10">
        <div className="relative overflow-hidden rounded-hero bg-brand-gradient p-6 text-white shadow-pop md:p-10">
          <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 opacity-50" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 animate-float rounded-[28px] bg-accent/90" />
          <div className="relative grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-100">College league</p>
              <h1 className="display mt-2 text-4xl font-extrabold md:text-5xl">Every game counts for your college.</h1>
              <p className="mt-3 max-w-xl text-brand-100">
                Nothing to sign up for. The host picks a college when creating a room. When the game ends, every player's points are added to that college.
                Play more, climb higher.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Link to="/host">
                <Button size="lg" variant="accent">
                  Host a game for your college
                </Button>
              </Link>
              <p className="text-sm text-brand-100">{data ? `${data.games} games counted in this period` : "Loading"}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented options={PERIODS} value={period} onChange={setPeriod} label="Period" />
          <input className={`${inputClass} max-w-xs py-2`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a college or player" aria-label="Find a college or player" />
        </div>

        {error ? (
          <Banner tone="bad" className="mt-6">
            {error}
          </Banner>
        ) : null}
        {!data && !error ? (
          <div className="mt-6">
            <Spinner label="Loading league" />
          </div>
        ) : null}

        {data ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <Card>
              <h2 className="display text-2xl font-bold">Top colleges</h2>
              <p className="text-sm text-muted">Ranked by total points from every finished game</p>
              {colleges.length === 0 ? (
                <p className="mt-6 text-sm text-muted">{q ? "No college matches that search." : "No finished games yet. Host one and the table fills up."}</p>
              ) : (
                <ol className="mt-4 flex flex-col gap-2">
                  {colleges.map((c, i) => (
                    <li key={c.college} className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${i === 0 ? "border-accent/40 bg-accent-soft/60 border-l-4 border-l-accent" : "border-line bg-white"}`}>
                      <span className={`display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${rankChip(i)}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{c.college}</span>
                        <span className="block text-xs text-muted">
                          {c.games} {c.games === 1 ? "game" : "games"}, best {c.bestPlayer} with {c.bestScore}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-lg font-extrabold tabular">{c.totalPoints}</span>
                        <span className="block text-xs text-muted">avg {c.avgPoints} / player</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <div className="flex flex-col gap-6">
              <Card>
                <h2 className="display text-2xl font-bold">Top players</h2>
                <p className="text-sm text-muted">Points added up from every game they played</p>
                {players.length === 0 ? (
                  <p className="mt-6 text-sm text-muted">Nobody on the board yet.</p>
                ) : (
                  <ol className="mt-4 flex flex-col gap-2">
                    {players.slice(0, 15).map((p, i) => (
                      <li key={`${p.college}-${p.name}`} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                        <span className={`display flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${rankChip(i)}`}>{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{p.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {p.college}, {p.games} {p.games === 1 ? "game" : "games"}, {p.accuracy}% accuracy
                          </span>
                        </span>
                        <span className="font-extrabold tabular">{p.totalPoints}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
              <Card>
                <h2 className="display text-xl font-bold">Recent games</h2>
                {recent.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No games yet.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {recent.map((g) => (
                      <li key={`${g.code}-${g.endedAt}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{g.college}</span>
                          <span className="block truncate text-xs text-muted">
                            {g.setTitle}, {g.players.length} {g.players.length === 1 ? "player" : "players"}, {g.questions} questions
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-muted">{timeAgo(g.endedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
