import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { animate, motion } from "framer-motion";
import { Shell } from "../components/Layout.jsx";
import { Badge, Banner, Button, Card, Field, Spinner, Stat, inputClass } from "../components/ui.jsx";
import { Timer } from "../components/Timer.jsx";
import { OptionTile } from "../components/OptionTile.jsx";
import { Leaderboard } from "../components/Leaderboard.jsx";
import { QuestionBody } from "../components/QuestionBody.jsx";
import { Confetti } from "../components/Confetti.jsx";
import { Countdown } from "../components/RoomSettings.jsx";
import { request, socket, useSocketEvents } from "../lib/socket.js";
import { lastName, playerSeat } from "../lib/storage.js";
import { ordinal, seconds, signed, topicLabel } from "../lib/format.js";

const TERMINAL = new Set(["join", "resuming", "kicked", "replaced", "closed"]);

function withAutoNext(reveal) {
  return { ...reveal, autoNextAt: typeof reveal.autoNextMs === "number" ? Date.now() + reveal.autoNextMs : null };
}

export default function Play() {
  const { code: codeParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [code, setCode] = useState((codeParam || "").toUpperCase());
  const [name, setName] = useState(location.state?.name || lastName.get());
  const [phase, setPhase] = useState("join");
  const [me, setMe] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [lock, setLock] = useState(null);
  const [progress, setProgress] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [standings, setStandings] = useState(null);
  const [end, setEnd] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const autoJoined = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const applyState = useCallback((state) => {
    if (state.lobby) setLobby(state.lobby);
    if (state.status === "question") {
      const q = state.question;
      setQuestion({ ...q, endsAt: Date.now() + q.remainingMs });
      setSelected(q.answered ? q.answeredPos : null);
      setLock(q.answered ? { elapsedMs: null } : null);
      setProgress({ answeredCount: q.answeredCount, playerCount: q.playerCount });
    }
    if (state.status === "reveal") {
      setReveal(withAutoNext(state.reveal));
      setStandings({ top: state.reveal.top, me: state.reveal.me, playerCount: state.reveal.playerCount });
    }
    if (state.status === "ended") setEnd(state.end);
    setPhase(state.status);
  }, []);

  const join = useCallback(
    async (joinCode, joinName) => {
      setError("");
      setBusy(true);
      const res = await request("player:join", { code: joinCode, name: joinName });
      setBusy(false);
      if (!res.ok) return setError(res.error || "Could not join");
      playerSeat.set(joinCode, { token: res.token, name: res.name });
      lastName.set(joinName);
      setMe({ id: res.playerId, name: res.name });
      applyState(res.state);
      if (codeParam !== joinCode) navigate(`/play/${joinCode}`, { replace: true });
    },
    [applyState, codeParam, navigate],
  );

  const resume = useCallback(async () => {
    const seat = codeParam ? playerSeat.get(codeParam) : null;
    if (!seat?.token) return "none";
    const res = await request("player:resume", { code: codeParam, token: seat.token });
    if (!res.ok) {
      if (res.reason === "timeout") return "retry";
      playerSeat.clear(codeParam);
      return "rejected";
    }
    setMe({ id: res.playerId, name: res.name });
    setError("");
    applyState(res.state);
    return "ok";
  }, [codeParam, applyState]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seat = codeParam ? playerSeat.get(codeParam) : null;
      if (seat?.token) {
        setPhase("resuming");
        const outcome = await resume();
        if (cancelled) return;
        if (outcome === "rejected" || outcome === "none") setPhase("join");
        if (outcome === "retry") setError("Still connecting. We will keep trying.");
        return;
      }
      if (location.state?.autoJoin && codeParam && !autoJoined.current) {
        autoJoined.current = true;
        join(codeParam, location.state.name);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  useEffect(() => {
    const onReconnect = async () => {
      const current = phaseRef.current;
      if (current === "resuming" || !TERMINAL.has(current)) {
        const outcome = await resume();
        if (outcome === "rejected") setPhase("join");
      }
    };
    socket.on("connect", onReconnect);
    return () => socket.off("connect", onReconnect);
  }, [resume]);

  useSocketEvents(
    {
      "room:lobby": (l) => setLobby(l),
      "question:start": (q) => {
        setQuestion({ ...q, endsAt: Date.now() + q.remainingMs });
        setSelected(null);
        setLock(null);
        setReveal(null);
        setError("");
        setProgress({ answeredCount: q.answeredCount, playerCount: q.playerCount });
        setPhase("question");
      },
      "question:progress": (p) => setProgress({ answeredCount: p.answeredCount, playerCount: p.playerCount }),
      "question:reveal": (r) => {
        setReveal(withAutoNext(r));
        setStandings({ top: r.top, me: r.me, playerCount: r.playerCount });
        setPhase("reveal");
      },
      "room:auto": (a) => setReveal((prev) => (prev ? withAutoNext({ ...prev, autoAdvance: a.autoAdvance, autoNextMs: a.autoNextMs }) : prev)),
      "game:end": (e) => {
        setEnd(e);
        setError("");
        setPhase("ended");
      },
      "player:kicked": () => {
        if (codeParam) playerSeat.clear(codeParam);
        setPhase("kicked");
      },
      "session:replaced": () => setPhase("replaced"),
      "room:closed": () => setPhase("closed"),
    },
    [codeParam],
  );

  useEffect(() => {
    const onVisibility = () => socket.emit("player:visibility", { hidden: document.hidden });
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const answer = useCallback(
    async (pos) => {
      if (phase !== "question" || !question || selected !== null) return;
      setSelected(pos);
      const res = await request("player:answer", { qIndex: question.qIndex, pos });
      if (res.accepted) {
        setLock({ elapsedMs: res.elapsedMs });
      } else if (res.reason === "late" || res.reason === "closed") {
        setLock({ late: true });
      } else if (res.reason === "duplicate") {
        setLock({ elapsedMs: null });
      } else {
        setSelected(null);
        setError(res.error || "Your answer did not go through. Tap again.");
      }
    },
    [phase, question, selected],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (phase !== "question" || !question) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const digit = Number(e.key);
      const letter = "abcdef".indexOf(e.key.toLowerCase());
      const pos = Number.isInteger(digit) && digit >= 1 ? digit - 1 : letter;
      if (pos >= 0 && pos < question.options.length) answer(pos);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, question, answer]);

  const submitJoin = (e) => {
    e.preventDefault();
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length !== 6) return setError("The room code has 6 letters or digits.");
    if (!name.trim()) return setError("Enter a name.");
    join(clean, name.trim());
  };

  if (phase === "join") {
    return (
      <Shell full>
        <div className="mx-auto max-w-md px-4 pb-10">
          <div className="-mx-4 rounded-b-[32px] bg-brand-gradient px-6 pb-16 pt-8 text-white shadow-pop">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-100">Player</p>
            <h1 className="display mt-2 text-4xl font-extrabold">Join a game</h1>
            <p className="mt-2 text-brand-100">Get the room code from your host.</p>
          </div>
          <Card as="form" onSubmit={submitJoin} className="relative -mt-10 rounded-3xl border-0 shadow-pop md:p-7">
            <div className="flex flex-col gap-4">
              <Field id="code" label="Room code">
                <input
                  id="code"
                  className={`${inputClass} display h-16 text-center text-[32px] font-bold uppercase tracking-[0.3em]`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="ABC123"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={6}
                />
              </Field>
              <Field id="name" label="Name">
                <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={20} autoComplete="nickname" />
              </Field>
              {error ? (
                <p role="alert" className="rounded-xl bg-bad-bg px-3 py-2 text-sm font-bold text-bad">
                  {error}
                </p>
              ) : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Joining" : "Join"}
              </Button>
            </div>
          </Card>
        </div>
      </Shell>
    );
  }

  if (phase === "resuming") {
    return (
      <Shell nav={false}>
        <div className="flex flex-col items-start gap-4">
          <Spinner label="Getting you back into the room" />
          {error ? <Banner tone="warm">{error}</Banner> : null}
        </div>
      </Shell>
    );
  }

  if (phase === "kicked" || phase === "replaced" || phase === "closed") {
    const messages = {
      kicked: "The host removed you from this room.",
      replaced: "You opened this game on another tab or device, so this one stepped aside.",
      closed: "This room has closed.",
    };
    return (
      <Shell>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
          <Banner className="w-full">{messages[phase]}</Banner>
          <div className="flex gap-2">
            {phase === "replaced" ? (
              <Button
                onClick={async () => {
                  const outcome = await resume();
                  if (outcome === "rejected") setPhase("join");
                }}
              >
                Use this tab instead
              </Button>
            ) : null}
            <Link to="/">
              <Button variant="secondary">Back to home</Button>
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell nav={false} full>
      <div className="mx-auto max-w-5xl px-4 py-5">
        {error ? (
          <Banner tone="bad" className="mb-4">
            {error}
          </Banner>
        ) : null}
        {phase === "lobby" && lobby ? <LobbyView lobby={lobby} me={me} /> : null}
        {phase === "question" && question ? (
          <QuestionView question={question} selected={selected} lock={lock} progress={progress} standings={standings} me={me} onAnswer={answer} />
        ) : null}
        {phase === "reveal" && reveal ? <RevealView reveal={reveal} me={me} /> : null}
        {phase === "ended" && end ? <ReportCard end={end} me={me} /> : null}
      </div>
    </Shell>
  );
}

function LobbyView({ lobby, me }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-6 text-center">
      <div className="pop flex h-24 w-24 items-center justify-center rounded-full bg-brand-gradient shadow-pop">
        <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="#fbbf24" strokeWidth="3" aria-hidden="true">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <h1 className="display text-4xl font-extrabold">You're in, {me?.name}</h1>
        <p className="mt-2 text-muted">Watch the big screen. The first question shows here when the host starts.</p>
      </div>
      <Card className="w-full text-left">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="display text-4xl font-bold tabular">{lobby.players.length}</p>
            <p className="text-sm font-semibold text-muted">in the room</p>
          </div>
          <Badge tone="brand">{lobby.questionCount} questions</Badge>
        </div>
        <p className="mt-3 text-sm text-muted">
          {lobby.setTitle}. {lobby.settings.questionTime} seconds per question.
        </p>
        <p className="mt-1 text-sm text-muted">{lobby.scoring.text}</p>
        {lobby.settings.examMode ? (
          <Badge tone="accent" className="mt-2">
            Exam mode: negative marking
          </Badge>
        ) : null}
      </Card>
      <p className="flex items-center gap-2 text-sm font-bold text-muted">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-brand-600" aria-hidden="true" />
        Waiting for the host to start
      </p>
      <p className="text-xs text-muted">On a laptop you can answer with keys 1 to 6 or A to F.</p>
    </div>
  );
}

function StandingsSummary({ standings }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Your place</p>
        <p className="display text-2xl font-bold">
          {ordinal(standings.me.rank)} <span className="text-sm font-semibold text-muted">of {standings.playerCount}</span>
        </p>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Points</p>
        <p className="display text-2xl font-bold tabular">{standings.me.score}</p>
      </div>
    </div>
  );
}

function StandingsPanel({ standings, me, compact = false }) {
  if (!standings?.me) {
    return compact ? null : (
      <Card className="hidden lg:block">
        <h2 className="display text-xl font-bold">Standings</h2>
        <p className="mt-1 text-sm text-muted">The leaderboard shows here after the first question.</p>
      </Card>
    );
  }
  if (compact) {
    return (
      <details className="rounded-card border border-line bg-white p-4 shadow-card lg:hidden">
        <summary className="cursor-pointer list-none">
          <StandingsSummary standings={standings} />
          <p className="mt-2 text-xs font-bold text-brand-700">Tap to see the top five</p>
        </summary>
        <div className="mt-3">
          <Leaderboard entries={standings.top} highlightId={me?.id} limit={5} dense showLast={false} />
        </div>
      </details>
    );
  }
  return (
    <Card className="hidden lg:block">
      <h2 className="display text-xl font-bold">Standings</h2>
      <p className="mb-3 text-sm text-muted">After the last question</p>
      <StandingsSummary standings={standings} />
      <div className="mt-4">
        <Leaderboard entries={standings.top} highlightId={me?.id} limit={5} dense showLast={false} />
      </div>
    </Card>
  );
}

function QuestionView({ question, selected, lock, progress, standings, me, onAnswer }) {
  const locked = selected !== null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <div className="sticky top-[57px] z-10 -mx-4 bg-white/95 px-4 pb-3 pt-2 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <Badge tone="brand">
              {question.qIndex + 1} of {question.total}
            </Badge>
            <span className="text-sm font-bold text-muted">{topicLabel(question.topic)}</span>
          </div>
          <Timer endsAt={question.endsAt} durationMs={question.durationMs} />
        </div>
        <Card className="border-l-4 border-l-brand-700 p-4 md:p-6">
          <QuestionBody text={question.text} table={question.table} image={question.image} />
        </Card>
        <div className="grid gap-3">
          {question.options.map((opt, i) => (
            <OptionTile key={`${question.qIndex}-${i}`} index={i} text={opt} state={selected === i ? "selected" : "idle"} onClick={() => onAnswer(i)} disabled={locked} delay={i * 60} />
          ))}
        </div>
        <div aria-live="polite" className="min-h-6 text-center text-sm font-bold text-muted">
          {lock?.late ? (
            "Too late, that round had already closed."
          ) : locked ? (
            <span key="locked" className="rise inline-block">
              Locked in{lock?.elapsedMs ? <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-xs text-white">{seconds(lock.elapsedMs)}</span> : null}. Waiting for the answer.
            </span>
          ) : (
            "Tap your answer. Faster correct answers get more points."
          )}
          {progress ? (
            <span className="block text-xs font-normal">
              {progress.answeredCount} of {progress.playerCount} answered
            </span>
          ) : null}
        </div>
        <StandingsPanel standings={standings} me={me} compact />
      </div>
      <div className="flex flex-col gap-4">
        <StandingsPanel standings={standings} me={me} />
        <Card className="hidden lg:block">
          <h2 className="display text-xl font-bold">Scoring</h2>
          <p className="mt-1 text-sm text-muted">{question.scoring.text}</p>
          <p className="mt-2 text-xs text-muted">Keys 1 to 6 or A to F answer too.</p>
        </Card>
      </div>
    </div>
  );
}

function CountUp({ value }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, { duration: 0.8, ease: "easeOut", onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [value]);
  return <>{signed(shown)}</>;
}

function RevealView({ reveal, me }) {
  const you = reveal.you;
  const tone = you.answered ? (you.correct ? "good" : "bad") : "neutral";
  const title = !you.answered ? "No answer" : you.correct ? "Correct" : "Not this time";
  const toneClass = tone === "good" ? "bg-good text-white" : tone === "bad" ? "bg-bad text-white" : "bg-ink text-white";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className={`relative overflow-hidden rounded-card p-6 text-center shadow-pop ${toneClass}`}
        >
          {you.correct ? <Confetti /> : null}
          <p className="display text-4xl font-extrabold">{title}</p>
          <p className="display mt-2 text-5xl font-extrabold tabular">{you.answered ? <CountUp value={you.points} /> : "0"}</p>
          <p className="mt-1 text-sm opacity-90">points{you.answered && you.elapsedMs !== null ? `, answered in ${seconds(you.elapsedMs)}` : ""}</p>
        </motion.div>
        <Card>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
            Question {reveal.qIndex + 1} of {reveal.total}
          </p>
          <p className="mt-1 font-bold">{reveal.text}</p>
        </Card>
        <div className="grid gap-3">
          {reveal.options.map((opt, i) => {
            const state = i === reveal.correctPos ? "correct" : you.answered && you.pos === i ? "wrong" : "dim";
            return <OptionTile key={`r-${reveal.qIndex}-${i}`} index={i} text={opt} state={state} count={reveal.counts[i]} total={reveal.answered} />;
          })}
        </div>
        {reveal.explanation ? (
          <div className="rounded-card border-2 border-accent/40 bg-accent-soft p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-warm">Why</p>
            <p className="mt-1 text-sm text-ink">{reveal.explanation}</p>
          </div>
        ) : null}
        <p className="text-center text-sm font-bold text-muted">
          {reveal.autoAdvance && reveal.autoNextAt ? <Countdown endsAt={reveal.autoNextAt} prefix={reveal.isLast ? "Results in" : "Next question in"} /> : "The host will start the next question."}
        </p>
      </div>
      {reveal.me ? (
        <div className="flex flex-col gap-4">
          <Card className="animate-rise">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Your place</p>
                <p className="display text-3xl font-bold">
                  {ordinal(reveal.me.rank)} <span className="text-base font-semibold text-muted">of {reveal.playerCount}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Total</p>
                <p className="display text-3xl font-bold tabular">{reveal.me.score}</p>
              </div>
            </div>
            <div className="mt-4">
              <Leaderboard entries={reveal.top} highlightId={me?.id} limit={5} dense showLast={false} />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function verdict(p, report) {
  const costs = [
    ["speed", p.speedCost],
    ["errors", p.errorCost],
    ["missed", p.missedCost],
  ].sort((a, b) => b[1] - a[1]);
  const [top, value] = costs[0];
  if (value === 0) return "Perfect game. Every answer right, every answer fast.";
  if (top === "speed") return `You lost the most points to speed. You got ${report.correct} of ${report.questions} right, but slow answers cost you ${value} points.`;
  if (top === "errors") return `You lost the most points to wrong answers: ${value} points on ${report.wrong} questions. Take a little more time on the topics below.`;
  return `You lost the most points by not answering: ${value} points on ${report.skipped} questions. Always try; a guess costs nothing in game mode.`;
}

function ReportCard({ end, me }) {
  const r = end.report;
  const p = r.pressure;
  const total = p.maxPossible || 1;
  const earned = Math.max(0, p.earned);
  const segs = [
    ["Earned", earned, "bg-brand-600"],
    ["Lost to speed", p.speedCost, "bg-accent"],
    ["Lost to errors", p.errorCost, "bg-bad"],
    ["Lost to skipping", p.missedCost, "bg-line"],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <div className="relative animate-rise overflow-hidden rounded-hero bg-brand-gradient p-6 text-white shadow-pop">
          <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 opacity-50" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rotate-12 rounded-[24px] bg-accent/90" />
          <div className="relative">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-100">Final result</p>
            <p className="mt-1 text-sm font-bold">{r.name}</p>
            <p className="display mt-2 text-5xl font-extrabold">
              {ordinal(r.rank)} <span className="text-xl font-semibold text-brand-100">of {r.players}</span>
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular text-accent">{r.score} points</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                ["Accuracy", `${r.accuracy}%`],
                ["Avg speed", r.avgSpeedS === null ? "-" : `${r.avgSpeedS}s`],
                ["Fastest", r.fastestCorrectS === null ? "-" : `${r.fastestCorrectS}s`],
              ].map(([label, value]) => (
                <span key={label} className="rounded-xl bg-white/15 px-3 py-2 text-sm font-bold">
                  <span className="text-brand-100">{label}</span> <span className="tabular">{value}</span>
                </span>
              ))}
            </div>
            <p className="display mt-6 text-right text-sm font-bold text-brand-100">AptiQuiz</p>
          </div>
        </div>

        <Card>
          <h2 className="display text-xl font-bold">Where your points went</h2>
          <p className="mt-1 text-base text-ink">{verdict(p, r)}</p>
          <div className="mt-4 flex h-5 w-full overflow-hidden rounded-full bg-line" role="img" aria-label="Breakdown of possible points">
            {segs.map(([label, value, color], i) => (
              <div key={label} className={`origin-left animate-grow ${color}`} style={{ width: `${(100 * value) / total}%`, animationDelay: `${i * 80}ms` }} title={`${label}: ${value}`} />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {segs.map(([label, value, color]) => (
              <li key={label} className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${color}`} aria-hidden="true" />
                <span className="text-muted">{label}</span>
                <span className="ml-auto font-extrabold tabular">{value}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="display text-xl font-bold">Under pressure</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat
              label="Late answers"
              value={p.lateAccuracy === null ? "-" : `${p.lateAccuracy}%`}
              sub={`${p.lateCount} with under a quarter of the time left`}
              tone={p.lateAccuracy !== null && p.earlyAccuracy !== null && p.lateAccuracy < p.earlyAccuracy ? "bad" : "neutral"}
              className="bg-surface p-3"
            />
            <Stat label="Early answers" value={p.earlyAccuracy === null ? "-" : `${p.earlyAccuracy}%`} sub={`${p.earlyCount} answered with time to spare`} className="bg-surface p-3" />
            <Stat label="Right after a mistake" value={p.afterMistakeAccuracy === null ? "-" : `${p.afterMistakeAccuracy}%`} sub={`${p.afterMistakeCount} such questions`} className="bg-surface p-3" />
            <Stat label="Overall" value={`${r.accuracy}%`} sub="all questions" tone="brand" className="bg-surface p-3" />
          </div>
          <p className="mt-3 text-xs text-muted">If your late answers score much lower than your early ones, the clock is beating you, not the questions.</p>
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <h2 className="display text-xl font-bold">Topics</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {r.topics.map((t) => (
              <li key={t.topic}>
                <div className="flex justify-between text-sm font-bold">
                  <span>{topicLabel(t.topic)}</span>
                  <span className="tabular text-muted">
                    {t.correct}/{t.total} {t.avgSpeedS !== null ? `at ${t.avgSpeedS}s` : ""}
                  </span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-line">
                  <div className={`h-full origin-left animate-grow rounded-full ${t.accuracy >= 70 ? "bg-good" : t.accuracy >= 40 ? "bg-accent" : "bg-bad"}`} style={{ width: `${t.accuracy}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="display text-xl font-bold">Top 10</h2>
          <div className="mt-3">
            <Leaderboard entries={end.top} highlightId={me?.id} limit={10} showDelta={false} showLast={false} dense />
          </div>
        </Card>

        <div className="flex flex-col gap-3 pb-6 sm:flex-row">
          <Link to="/league" className="flex-1">
            <Button className="w-full">College league</Button>
          </Link>
          <Link to="/" className="flex-1">
            <Button variant="secondary" className="w-full">
              Play another game
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
