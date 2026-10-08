import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Shell } from "../components/Layout.jsx";
import { Badge, Banner, Button, Card, Field, Spinner, Stat, inputClass } from "../components/ui.jsx";
import { Timer } from "../components/Timer.jsx";
import { OptionTile } from "../components/OptionTile.jsx";
import { Leaderboard } from "../components/Leaderboard.jsx";
import { QuestionBody } from "../components/QuestionBody.jsx";
import { request, socket, useSocketEvents } from "../lib/socket.js";
import { lastName, playerSeat } from "../lib/storage.js";
import { ordinal, seconds, signed, topicLabel } from "../lib/format.js";

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
  const [end, setEnd] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const autoJoined = useRef(false);

  const applyState = useCallback((state) => {
    if (state.lobby) setLobby(state.lobby);
    if (state.status === "question") {
      const q = state.question;
      setQuestion({ ...q, endsAt: Date.now() + q.remainingMs });
      setSelected(q.answered ? q.answeredPos : null);
      setLock(q.answered ? { elapsedMs: null } : null);
      setProgress({ answeredCount: q.answeredCount, playerCount: q.playerCount });
    }
    if (state.status === "reveal") setReveal(state.reveal);
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
    if (!seat?.token) return false;
    const res = await request("player:resume", { code: codeParam, token: seat.token });
    if (!res.ok) {
      playerSeat.clear(codeParam);
      return false;
    }
    setMe({ id: res.playerId, name: res.name });
    applyState(res.state);
    return true;
  }, [codeParam, applyState]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seat = codeParam ? playerSeat.get(codeParam) : null;
      if (seat?.token) {
        setPhase("resuming");
        const ok = await resume();
        if (!ok && !cancelled) setPhase("join");
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
    const onReconnect = () => {
      if (phase !== "join" && phase !== "resuming") resume();
    };
    socket.on("connect", onReconnect);
    return () => socket.off("connect", onReconnect);
  }, [phase, resume]);

  useSocketEvents(
    {
      "room:lobby": (l) => setLobby(l),
      "question:start": (q) => {
        setQuestion({ ...q, endsAt: Date.now() + q.remainingMs });
        setSelected(null);
        setLock(null);
        setReveal(null);
        setProgress({ answeredCount: q.answeredCount, playerCount: q.playerCount });
        setPhase("question");
      },
      "question:progress": (p) => setProgress({ answeredCount: p.answeredCount, playerCount: p.playerCount }),
      "question:reveal": (r) => {
        setReveal(r);
        setPhase("reveal");
      },
      "game:end": (e) => {
        setEnd(e);
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
      <Shell>
        <Card as="form" onSubmit={submitJoin} className="mx-auto max-w-md md:p-7">
          <h1 className="text-2xl font-extrabold">Join a game</h1>
          <p className="mt-1 text-sm text-muted">Ask your host for the room code on the big screen.</p>
          <div className="mt-5 flex flex-col gap-4">
            <Field id="code" label="Room code">
              <input
                id="code"
                className={`${inputClass} text-center text-2xl font-extrabold uppercase tracking-[0.3em]`}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={6}
              />
            </Field>
            <Field id="name" label="Your name">
              <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown on the leaderboard" maxLength={20} autoComplete="nickname" />
            </Field>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-bad">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Joining" : "Join"}
            </Button>
          </div>
        </Card>
      </Shell>
    );
  }

  if (phase === "resuming") {
    return (
      <Shell nav={false}>
        <Spinner label="Getting you back into the room" />
      </Shell>
    );
  }

  if (phase === "kicked" || phase === "replaced" || phase === "closed") {
    const messages = {
      kicked: "The host removed you from this room.",
      replaced: "You opened this game on another tab or device. This one has been signed out.",
      closed: "This room has closed.",
    };
    return (
      <Shell>
        <div className="mx-auto max-w-md text-center">
          <Banner>{messages[phase]}</Banner>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="secondary">Back to home</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell nav={false}>
      <div className="mx-auto max-w-xl">
        {error ? (
          <Banner tone="bad" className="mb-4">
            {error}
          </Banner>
        ) : null}
        {phase === "lobby" && lobby ? <LobbyView lobby={lobby} me={me} /> : null}
        {phase === "question" && question ? <QuestionView question={question} selected={selected} lock={lock} progress={progress} onAnswer={answer} /> : null}
        {phase === "reveal" && reveal ? <RevealView reveal={reveal} me={me} /> : null}
        {phase === "ended" && end ? <ReportCard end={end} me={me} /> : null}
      </div>
    </Shell>
  );
}

function LobbyView({ lobby, me }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="pop flex h-20 w-20 items-center justify-center rounded-full bg-good text-white shadow-lg shadow-good/30">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <h1 className="text-3xl font-extrabold">You're in, {me?.name}</h1>
        <p className="mt-2 text-muted">Look at the host screen. The first question appears here the moment the host presses Start.</p>
      </div>
      <Card className="w-full text-left">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{lobby.players.length} in the room</span>
          <Badge tone="brand">{lobby.questionCount} questions</Badge>
        </div>
        <p className="mt-2 text-sm text-muted">{lobby.setTitle}. {lobby.settings.questionTime} seconds per question.</p>
        <p className="mt-2 text-sm text-muted">{lobby.scoring.text}</p>
        {lobby.settings.examMode ? (
          <Badge tone="warm" className="mt-2">
            Exam mode: negative marking
          </Badge>
        ) : null}
      </Card>
      <p className="text-xs text-muted">Tip: on a laptop you can answer with keys 1 to 4.</p>
    </div>
  );
}

function QuestionView({ question, selected, lock, progress, onAnswer }) {
  const locked = selected !== null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge tone="brand">
          {question.qIndex + 1} of {question.total}
        </Badge>
        <span className="text-sm font-semibold text-muted">{topicLabel(question.topic)}</span>
      </div>
      <Timer endsAt={question.endsAt} durationMs={question.durationMs} />
      <Card>
        <QuestionBody text={question.text} table={question.table} image={question.image} />
      </Card>
      <div className="grid gap-3">
        {question.options.map((opt, i) => (
          <OptionTile key={i} index={i} text={opt} state={selected === i ? "selected" : "idle"} onClick={() => onAnswer(i)} disabled={locked} />
        ))}
      </div>
      <div aria-live="polite" className="min-h-6 text-center text-sm font-semibold text-muted">
        {lock?.late ? "Too late, that round had already closed." : locked ? `Locked in${lock?.elapsedMs ? ` at ${seconds(lock.elapsedMs)}` : ""}. Waiting for the reveal.` : "Tap your answer. Faster correct answers score more."}
        {progress ? (
          <span className="block text-xs font-normal">
            {progress.answeredCount} of {progress.playerCount} answered
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RevealView({ reveal, me }) {
  const you = reveal.you;
  const tone = you.answered ? (you.correct ? "good" : "bad") : "neutral";
  const title = !you.answered ? "No answer" : you.correct ? "Correct" : "Not this time";
  const toneClass = tone === "good" ? "bg-good text-white" : tone === "bad" ? "bg-bad text-white" : "bg-ink text-white";
  return (
    <div className="flex flex-col gap-4">
      <div role="status" aria-live="polite" className={`rise rounded-2xl p-5 text-center shadow-lg ${toneClass}`}>
        <p className="text-3xl font-extrabold">{title}</p>
        <p className="mt-1 text-xl font-bold tabular">{you.answered ? `${signed(you.points)} points` : "0 points"}</p>
        {you.answered && you.elapsedMs !== null ? <p className="mt-1 text-sm opacity-90">Answered in {seconds(you.elapsedMs)}</p> : null}
      </div>
      <Card>
        <p className="text-sm font-semibold text-muted">
          Question {reveal.qIndex + 1} of {reveal.total}
        </p>
        <p className="mt-1 font-bold">{reveal.text}</p>
      </Card>
      <div className="grid gap-3">
        {reveal.options.map((opt, i) => {
          const state = i === reveal.correctPos ? "correct" : you.answered && you.pos === i ? "wrong" : "dim";
          return <OptionTile key={i} index={i} text={opt} state={state} count={reveal.counts[i]} total={reveal.answered} />;
        })}
      </div>
      {reveal.explanation ? (
        <Card className="bg-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Why</p>
          <p className="mt-1 text-sm">{reveal.explanation}</p>
        </Card>
      ) : null}
      {reveal.me ? (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your place</p>
              <p className="text-2xl font-extrabold">
                {ordinal(reveal.me.rank)} <span className="text-base font-semibold text-muted">of {reveal.playerCount}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total</p>
              <p className="text-2xl font-extrabold tabular">{reveal.me.score}</p>
            </div>
          </div>
          <div className="mt-4">
            <Leaderboard entries={reveal.top} highlightId={me?.id} limit={5} dense />
          </div>
        </Card>
      ) : null}
      <p className="text-center text-sm text-muted">Next question comes from the host.</p>
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
  if (value === 0) return "A clean sheet. Every question right, every answer fast.";
  if (top === "speed") return `Speed, not knowledge, cost you the most. You got ${report.correct} of ${report.questions} right but left ${value} points on the clock.`;
  if (top === "errors") return `Wrong answers cost you the most: ${value} points across ${report.wrong} questions. Slow down a touch on the topics below.`;
  return `Unanswered questions cost you the most: ${value} points across ${report.skipped} questions. Always attempt; a guess costs nothing in game mode.`;
}

function ReportCard({ end, me }) {
  const r = end.report;
  const p = r.pressure;
  const total = p.maxPossible || 1;
  const earned = Math.max(0, p.earned);
  const segs = [
    ["Earned", earned, "bg-brand-600"],
    ["Lost to speed", p.speedCost, "bg-warm"],
    ["Lost to errors", p.errorCost, "bg-bad"],
    ["Lost to skipping", p.missedCost, "bg-line"],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Final result</p>
        <h1 className="mt-1 text-4xl font-extrabold">
          {ordinal(r.rank)} <span className="text-xl font-semibold text-muted">of {r.players}</span>
        </h1>
        <p className="mt-1 text-lg font-bold tabular text-brand-700">{r.score} points</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Accuracy" value={`${r.accuracy}%`} sub={`${r.correct} of ${r.questions}`} />
        <Stat label="Avg speed" value={r.avgSpeedS === null ? "-" : `${r.avgSpeedS}s`} sub="per answer" />
        <Stat label="Fastest" value={r.fastestCorrectS === null ? "-" : `${r.fastestCorrectS}s`} sub="correct answer" />
      </div>

      <Card>
        <h2 className="text-lg font-extrabold">Where your points went</h2>
        <p className="mt-1 text-sm text-muted">{verdict(p, r)}</p>
        <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-line" role="img" aria-label="Breakdown of possible points">
          {segs.map(([label, value, color]) => (
            <div key={label} className={color} style={{ width: `${(100 * value) / total}%` }} title={`${label}: ${value}`} />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {segs.map(([label, value, color]) => (
            <li key={label} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-sm ${color}`} aria-hidden="true" />
              <span className="text-muted">{label}</span>
              <span className="ml-auto font-bold tabular">{value}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">Under pressure</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Last-quarter answers" value={p.lateAccuracy === null ? "-" : `${p.lateAccuracy}%`} sub={`${p.lateCount} answers with under 25% time left`} tone={p.lateAccuracy !== null && p.earlyAccuracy !== null && p.lateAccuracy < p.earlyAccuracy ? "bad" : "neutral"} />
          <Stat label="Early answers" value={p.earlyAccuracy === null ? "-" : `${p.earlyAccuracy}%`} sub={`${p.earlyCount} answers with time to spare`} />
          <Stat label="Right after a mistake" value={p.afterMistakeAccuracy === null ? "-" : `${p.afterMistakeAccuracy}%`} sub={`${p.afterMistakeCount} such questions`} />
          <Stat label="Overall" value={`${r.accuracy}%`} sub="all questions" tone="brand" />
        </div>
        <p className="mt-3 text-xs text-muted">If the last-quarter number is far below the early one, the clock is beating you, not the questions.</p>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">Topics</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {r.topics.map((t) => (
            <li key={t.topic}>
              <div className="flex justify-between text-sm font-semibold">
                <span>{topicLabel(t.topic)}</span>
                <span className="tabular text-muted">
                  {t.correct}/{t.total} {t.avgSpeedS !== null ? `at ${t.avgSpeedS}s` : ""}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line">
                <div className={`h-full rounded-full ${t.accuracy >= 70 ? "bg-good" : t.accuracy >= 40 ? "bg-warm" : "bg-bad"}`} style={{ width: `${t.accuracy}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">Top 10</h2>
        <div className="mt-3">
          <Leaderboard entries={end.top} highlightId={me?.id} limit={10} showDelta={false} showLast={false} dense />
        </div>
      </Card>

      <div className="flex justify-center gap-3 pb-6">
        <Link to="/">
          <Button variant="secondary">Play another game</Button>
        </Link>
        <Link to="/league">
          <Button>College league</Button>
        </Link>
      </div>
    </div>
  );
}
