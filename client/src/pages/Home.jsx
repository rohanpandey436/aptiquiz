import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shell } from "../components/Layout.jsx";
import { Button, Card, Field, inputClass } from "../components/ui.jsx";
import { lastName } from "../lib/storage.js";

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

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState(lastName.get());
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length !== 6) return setError("The room code has 6 letters or digits.");
    if (!name.trim()) return setError("Enter the name your classmates will see.");
    lastName.set(name.trim());
    navigate(`/play/${clean}`, { state: { name: name.trim(), autoJoin: true } });
  };

  return (
    <Shell>
      <section className="relative isolate grid items-start gap-8 py-6 md:grid-cols-[1.1fr_1fr] md:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-24 -z-10 h-80 w-80 rounded-full bg-brand-100 opacity-70 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-32 -z-10 h-72 w-72 rounded-full bg-warm-bg opacity-80 blur-3xl" />
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-brand-700">Live aptitude arena</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Aptitude practice as a live game.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Up to 50 students answer the same placement-style questions at the same time, against the clock, with a leaderboard that moves after every
            round. Then each player learns exactly what cost them points: speed, mistakes or pressure.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/host">
              <Button size="lg">Host a game</Button>
            </Link>
            <Link to="/league">
              <Button size="lg" variant="secondary">
                College league
              </Button>
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Highlights">
            {proofs.map((p) => (
              <li key={p} className="rounded-full border border-line bg-white/80 px-3 py-1.5 text-sm font-semibold text-muted">
                {p}
              </li>
            ))}
          </ul>
        </div>

        <Card as="form" onSubmit={submit} className="md:p-7" aria-labelledby="join-title">
          <h2 id="join-title" className="text-xl font-extrabold">
            Join a game
          </h2>
          <p className="mt-1 text-sm text-muted">Ask your host for the room code shown on the big screen.</p>
          <div className="mt-5 flex flex-col gap-4">
            <Field id="join-code" label="Room code">
              <input
                id="join-code"
                className={`${inputClass} text-center text-2xl font-extrabold uppercase tracking-[0.3em]`}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                autoComplete="off"
                autoCapitalize="characters"
                inputMode="text"
                maxLength={6}
              />
            </Field>
            <Field id="join-name" label="Your name">
              <input id="join-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown on the leaderboard" maxLength={20} autoComplete="nickname" />
            </Field>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-bad">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg">
              Join
            </Button>
          </div>
        </Card>
      </section>

      <section className="py-8" aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-extrabold">
          How it works
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-line p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-extrabold text-white">{i + 1}</span>
              <h3 className="mt-3 font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 py-8 md:grid-cols-2" aria-labelledby="scoring-title">
        <Card>
          <h2 id="scoring-title" className="text-xl font-extrabold">
            Scoring, in the open
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <span className="font-semibold text-ink">Correct answer:</span> 500 points, plus up to 500 more the faster you answer.
            </li>
            <li>
              <span className="font-semibold text-ink">Wrong or skipped:</span> 0 points in game mode.
            </li>
            <li>
              <span className="font-semibold text-ink">Exam mode:</span> a wrong answer costs 250 points, the way real placement tests use negative marking. The host chooses
              the mode and every player sees it in the lobby.
            </li>
            <li>
              <span className="font-semibold text-ink">Ties:</span> broken by total answering time, faster first.
            </li>
          </ul>
        </Card>
        <Card>
          <h2 className="text-xl font-extrabold">Fair by design</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {fairness.map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden="true" className="mt-0.5 text-good">
                  &#10003;
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </Shell>
  );
}
