import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../components/Layout.jsx";
import { Badge, Banner, Button, Card, Field, Segmented, Spinner, inputClass } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { request } from "../lib/socket.js";
import { playerSeat } from "../lib/storage.js";
import { topicLabel } from "../lib/format.js";

const LEVELS = [
  ["mixed", "Mixed"],
  ["easy", "Easy"],
  ["medium", "Medium"],
  ["hard", "Hard"],
];

const PACES = [
  ["relaxed", "Relaxed, 40 s"],
  ["normal", "Normal, 20 s"],
  ["fast", "Fast, 10 s"],
];

const PACE_SECONDS = { relaxed: 40, normal: 20, fast: 10 };

export default function Practice() {
  const navigate = useNavigate();
  const [sets, setSets] = useState(null);
  const [setId, setSetId] = useState("");
  const [level, setLevel] = useState("mixed");
  const [pace, setPace] = useState("normal");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const settingsRef = useRef(null);

  const chooseSet = (id) => {
    setSetId(id);
    requestAnimationFrame(() => settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const loadSets = () => {
    setError("");
    setSets(null);
    api
      .get("/sets")
      .then((list) => {
        setSets(list);
        if (list.length) setSetId((current) => current || (list.find((s) => s.id === "seed_mix") || list[0]).id);
      })
      .catch((err) => {
        setSets([]);
        setError(err.message);
      });
  };

  useEffect(loadSets, []);

  const start = async (e) => {
    e.preventDefault();
    const cleanName = name.trim() || "You";
    setError("");
    setBusy(true);
    const res = await request("practice:start", { setId, difficulty: level, questionTime: PACE_SECONDS[pace], name: cleanName });
    setBusy(false);
    if (!res.ok) return setError(res.error || "Could not start practice");
    playerSeat.set(res.code, { token: res.token, name: res.name });
    navigate(`/play/${res.code}`);
  };

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-ink">Practice</p>
        <h1 className="display mt-2 text-4xl font-extrabold">Practice on your own</h1>
        <p className="mt-2 text-muted">No room, no host, no league. Pick a set, a level and a pace. You get the same report card at the end.</p>

        <form onSubmit={start} className="mt-8 flex flex-col gap-6">
          <Card>
            <h2 className="display text-xl font-bold">Question set</h2>
            {!sets ? (
              <Spinner label="Loading sets" />
            ) : sets.length === 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted">The sets could not be loaded.</p>
                <Button size="sm" variant="secondary" onClick={loadSets}>
                  Try again
                </Button>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Question set">
                {sets.map((s) => {
                  const active = s.id === setId;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      role="radio"
                      aria-checked={active}
                      onClick={() => chooseSet(s.id)}
                      className={`press rounded-tile border-2 p-4 text-left ${active ? "border-brand-700 bg-brand-50 shadow-card" : "border-line hover:border-brand-200"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="display text-lg font-bold leading-tight">{s.title}</span>
                        <Badge tone={active ? "brand" : "neutral"}>{s.count} Qs</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">{s.description}</p>
                      <p className="mt-2 text-xs text-muted">
                        {Object.entries(s.topics)
                          .map(([t, n]) => `${topicLabel(t)} ${n}`)
                          .join(" / ")}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card ref={settingsRef} className="flex scroll-mt-20 flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Level</span>
              <Segmented options={LEVELS} value={level} onChange={setLevel} label="Level" />
              <p className="text-xs text-muted">Mixed uses every question in the set. The others keep only that level.</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Pace</span>
              <Segmented options={PACES} value={pace} onChange={setPace} label="Pace" />
            </div>
            <Field id="practice-name" label="Name" hint="Only you see it; practice games are not counted in the league.">
              <input id="practice-name" className={`${inputClass} max-w-xs`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={20} />
            </Field>
          </Card>

          {error ? <Banner tone="bad">{error}</Banner> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={!setId || busy}>
              {busy ? "Starting" : "Start practice"}
            </Button>
            <span className="text-sm text-muted">Questions move on by themselves 8 seconds after each answer is shown.</span>
          </div>
        </form>
      </div>
    </Shell>
  );
}
