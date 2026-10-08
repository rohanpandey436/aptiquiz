import { useEffect, useState } from "react";
import { Shell } from "../components/Layout.jsx";
import { Banner, Card, Spinner } from "../components/ui.jsx";
import { api } from "../lib/api.js";

const PERIODS = [
  ["7d", "This week"],
  ["30d", "This month"],
  ["all", "All time"],
];

export default function League() {
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    api
      .get(`/league?period=${period}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [period]);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">College league</h1>
          <p className="mt-1 text-muted">Every finished room adds its points to the college it was hosted for.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-surface p-1" role="tablist" aria-label="Period">
          {PERIODS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={period === key} onClick={() => setPeriod(key)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${period === key ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
              {label}
            </button>
          ))}
        </div>
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
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="text-xl font-extrabold">Top colleges</h2>
            <p className="text-sm text-muted">{data.games} games in this period</p>
            {data.colleges.length === 0 ? (
              <p className="mt-6 text-sm text-muted">No finished games yet. Host one and the table fills itself.</p>
            ) : (
              <table className="mt-4 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">College</th>
                    <th className="py-2 pr-2 text-right">Games</th>
                    <th className="py-2 pr-2 text-right">Points</th>
                    <th className="py-2 text-right">Avg / player</th>
                  </tr>
                </thead>
                <tbody>
                  {data.colleges.map((c, i) => (
                    <tr key={c.college} className="border-t border-line">
                      <td className="py-2 pr-2 font-bold tabular">{i + 1}</td>
                      <td className="py-2 pr-2 font-semibold">
                        {c.college}
                        <span className="block text-xs font-normal text-muted">Best: {c.bestPlayer} ({c.bestScore})</span>
                      </td>
                      <td className="py-2 pr-2 text-right tabular">{c.games}</td>
                      <td className="py-2 pr-2 text-right font-bold tabular">{c.totalPoints}</td>
                      <td className="py-2 text-right tabular">{c.avgPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card>
            <h2 className="text-xl font-extrabold">Top players</h2>
            <p className="text-sm text-muted">Points added up across every game they played</p>
            {data.players.length === 0 ? (
              <p className="mt-6 text-sm text-muted">Nobody on the board yet.</p>
            ) : (
              <table className="mt-4 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Player</th>
                    <th className="py-2 pr-2 text-right">Games</th>
                    <th className="py-2 pr-2 text-right">Accuracy</th>
                    <th className="py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map((p, i) => (
                    <tr key={`${p.college}-${p.name}`} className="border-t border-line">
                      <td className="py-2 pr-2 font-bold tabular">{i + 1}</td>
                      <td className="py-2 pr-2 font-semibold">
                        {p.name}
                        <span className="block text-xs font-normal text-muted">{p.college}</span>
                      </td>
                      <td className="py-2 pr-2 text-right tabular">{p.games}</td>
                      <td className="py-2 pr-2 text-right tabular">{p.accuracy}%</td>
                      <td className="py-2 text-right font-bold tabular">{p.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      ) : null}
    </Shell>
  );
}
