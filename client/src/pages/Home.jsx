import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shell } from "../components/Layout.jsx";
import { Button, Card, Field, inputClass } from "../components/ui.jsx";
import { lastName } from "../lib/storage.js";
import { useReveal } from "../lib/useReveal.js";

const steps = [
  { title: "Host makes a room", text: "Pick a question set, get a 6-letter code and a QR code on the big screen." },
  { title: "Players join on phones", text: "Type the code and a name. No account, no app, nothing to install." },
  { title: "Race the clock", text: "Everyone sees the same question at the same moment. Faster correct answers score more." },
  { title: "See why you lost", text: "A report card shows points lost to speed, to mistakes and to pressure, topic by topic." },
];

const proofs = ["Up to 50 players a room", "Server-timed rounds", "Fair on slow Wi-Fi", "Report card after every game"];

const fairness = [
  "The server runs the clock and scores every answer. Your phone decides nothing.",
  "Your connection delay is measured and subtracted, so a slow network is not a handicap.",
  "Options are shuffled per player and the correct answer never reaches a phone before the reveal.",
  "Refresh or lose signal mid-game and you come back with the same score on the current question.",
];

const previewRows = [
  { rank: 1, name: "Ananya", score: 2860, delta: 2 },
  { rank: 2, name: "Rohan", score: 2790, delta: -1 },
  { rank: 3, name: "Zoya", score: 2410, delta: 1 },
];

function LeaderboardPreview() {
  return (
    <div aria-hidden="true" className="rounded-2xl border border-line bg-white p-3 shadow-card">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted">Live leaderboard</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {previewRows.map((r) => (
          <li key={r.name} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${r.rank === 1 ? "bg-accent-soft" : "bg-surface"}`}>
            <span className={`display flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${r.rank === 1 ? "bg-accent text-ink" : "bg-ink text-white"}`}>{r.rank}</span>
            <span className="flex-1 font-semibold">{r.name}</span>
            <span className={`text-xs font-extrabold ${r.delta > 0 ? "text-good" : "text-bad"}`}>
              {r.delta > 0 ? "▲" : "▼"}
              {Math.abs(r.delta)}
            </span>
            <span className="w-12 text-right font-extrabold tabular">{r.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState(lastName.get());
  const [error, setError] = useState("");
  useReveal();

  const submit = (e) => {
    e.preventDefault();
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length !== 6) return setError("The room code has 6 letters or digits.");
    if (!name.trim()) return setError("Enter the name your classmates will see.");
    lastName.set(name.trim());
    navigate(`/play/${clean}`, { state: { name: name.trim(), autoJoin: true } });
  };

  return (
    <Shell full>
      <section className="mx-auto max-w-6xl md:px-4 md:pt-8">
        <div className="relative overflow-hidden bg-brand-gradient text-white shadow-pop md:rounded-hero">
          <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 opacity-60" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 animate-float rounded-[28px] bg-accent/90" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-8 bottom-10 h-24 w-24 -rotate-6 rounded-2xl bg-white/10" />
          <div className="relative grid gap-10 px-5 pb-16 pt-10 md:grid-cols-[1.15fr_1fr] md:px-12 md:pb-20 md:pt-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink">
                <span className="h-2 w-2 rounded-full bg-ink" aria-hidden="true" />
                Live aptitude arena
              </span>
              <h1 className="display mt-5 text-5xl font-extrabold leading-[0.95] sm:text-6xl md:text-[56px] lg:text-7xl">
                Aptitude practice
                <br />
                as a <span className="text-accent">live game.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-100 md:text-xl">
                Fifty students, one question at a time, against the clock. A leaderboard that moves after every round, and a report card that says exactly what cost you
                points: speed, mistakes or pressure.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/host">
                  <Button size="lg" variant="accent">
                    Host a game
                  </Button>
                </Link>
                <Link to="/league">
                  <Button size="lg" variant="white">
                    College league
                  </Button>
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-2" aria-label="Highlights">
                {proofs.map((p) => (
                  <li key={p} className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-sm font-bold text-white">
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative md:translate-y-10">
              <Card as="form" onSubmit={submit} className="relative z-10 rounded-3xl border-0 p-6 text-ink shadow-pop md:p-8" aria-labelledby="join-title">
                <h2 id="join-title" className="display text-2xl font-bold">
                  Join a game
                </h2>
                <p className="mt-1 text-sm text-muted">Ask your host for the room code shown on the big screen.</p>
                <div className="mt-6 flex flex-col gap-4">
                  <Field id="join-code" label="Room code">
                    <input
                      id="join-code"
                      className={`${inputClass} display h-16 text-center text-[32px] font-bold uppercase tracking-[0.3em]`}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                      placeholder="ABC123"
                      autoComplete="off"
                      autoCapitalize="characters"
                      inputMode="text"
                      maxLength={6}
                    />
                  </Field>
                  <Field id="join-name" label="Name">
                    <input id="join-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={20} autoComplete="nickname" />
                  </Field>
                  {error ? (
                    <p role="alert" className="rounded-xl bg-bad-bg px-3 py-2 text-sm font-bold text-bad">
                      {error}
                    </p>
                  ) : null}
                  <Button type="submit" size="lg" className="w-full">
                    Join
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14 md:pt-24" aria-labelledby="how-title">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr]">
          <div className="reveal">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-800">How it works</p>
            <h2 id="how-title" className="display mt-3 text-4xl font-extrabold leading-tight md:text-5xl">
              Four steps. Ten minutes. No manual.
            </h2>
            <p className="mt-4 max-w-md text-muted">Built for a classroom, a hostel common room or a placement cell session. Nobody installs anything.</p>
            <div className="mt-8 hidden max-w-xs md:block">
              <LeaderboardPreview />
            </div>
          </div>
          <ol className="relative flex flex-col gap-7 border-l-2 border-brand-200 pl-8">
            {steps.map((s, i) => (
              <li key={s.title} className="reveal relative" style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="display absolute -left-[3.1rem] top-0 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-sm font-bold text-white shadow-button">
                  0{i + 1}
                </span>
                <h3 className="display text-xl font-bold">{s.title}</h3>
                <p className="mt-1 text-muted">{s.text}</p>
                {i === 2 ? (
                  <div className="mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-line" aria-hidden="true">
                    <div className="h-full w-2/3 rounded-full bg-brand-gradient" />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 md:py-24" aria-labelledby="scoring-title">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="reveal rounded-hero bg-tint-amber p-8">
            <h2 id="scoring-title" className="display text-3xl font-extrabold">
              Scoring, in the open
            </h2>
            <ul className="mt-5 space-y-3 text-muted">
              <li>
                <span className="font-bold text-ink">Correct answer:</span> <span className="font-extrabold tabular text-brand-700">500</span> points, plus up to{" "}
                <span className="font-extrabold tabular text-brand-700">+500</span> the faster you answer.
              </li>
              <li>
                <span className="font-bold text-ink">Wrong or skipped:</span> 0 points in game mode.
              </li>
              <li>
                <span className="font-bold text-ink">Exam mode:</span> a wrong answer costs 250 points, the way real placement tests use negative marking. The host picks the
                mode and every player sees it in the lobby.
              </li>
              <li>
                <span className="font-bold text-ink">Ties:</span> broken by total answering time, faster first.
              </li>
            </ul>
          </div>
          <div className="reveal rounded-hero bg-tint-green p-8" style={{ transitionDelay: "120ms" }}>
            <h2 className="display text-3xl font-extrabold">Fair by design</h2>
            <ul className="mt-5 space-y-3 text-muted">
              {fairness.map((f) => (
                <li key={f} className="flex gap-3">
                  <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-good text-[10px] font-bold text-white">
                    &#10003;
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-tint-blue">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:py-20">
          <div className="reveal">
            <h2 className="display text-3xl font-extrabold md:text-5xl">Host your first room in thirty seconds.</h2>
            <p className="mt-3 max-w-xl text-muted">Six built-in question sets, or write your own. Scores feed your college league from the very first game.</p>
          </div>
          <Link to="/host" className="reveal" style={{ transitionDelay: "120ms" }}>
            <Button size="lg">Host a game</Button>
          </Link>
        </div>
      </section>
    </Shell>
  );
}
