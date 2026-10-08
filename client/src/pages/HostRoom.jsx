import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Shell } from "../components/Layout.jsx";
import { Badge, Banner, Button, Card, Field, Segmented, Spinner, Stat, inputClass } from "../components/ui.jsx";
import { Timer } from "../components/Timer.jsx";
import { OptionTile } from "../components/OptionTile.jsx";
import { Leaderboard } from "../components/Leaderboard.jsx";
import { QuestionBody } from "../components/QuestionBody.jsx";
import { Confetti } from "../components/Confetti.jsx";
import { Countdown, LEVEL_CHOICES, TIME_CHOICES, Toggle } from "../components/RoomSettings.jsx";
import { api } from "../lib/api.js";
import { request, socket, useSocketEvents } from "../lib/socket.js";
import { hostSeat } from "../lib/storage.js";
import { LETTERS, downloadCsv, joinUrl, seconds, topicLabel } from "../lib/format.js";

const withAutoNext = (reveal) => ({ ...reveal, autoNextAt: typeof reveal.autoNextMs === "number" ? Date.now() + reveal.autoNextMs : null });

export default function HostRoom({ spectator = false }) {
  const { code } = useParams();
  const seat = useMemo(() => hostSeat.get(code), [code]);
  const [phase, setPhase] = useState("loading");
  const [lobby, setLobby] = useState(null);
  const [question, setQuestion] = useState(null);
  const [progress, setProgress] = useState({ answeredCount: 0, playerCount: 0 });
  const [reveal, setReveal] = useState(null);
  const [end, setEnd] = useState(null);
  const [flags, setFlags] = useState({});
  const [standings, setStandings] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);

  const applyState = useCallback((state) => {
    if (state.lobby) setLobby(state.lobby);
    if (state.status === "question") {
      setQuestion({ ...state.question, endsAt: Date.now() + state.question.remainingMs });
      setProgress({ answeredCount: state.question.answeredCount, playerCount: state.question.playerCount });
      if (state.question.leaderboard) setStandings(state.question.leaderboard);
    }
    if (state.status === "reveal") {
      setReveal(withAutoNext(state.reveal));
      setStandings(state.reveal.leaderboard || []);
    }
    if (state.status === "ended") setEnd(state.end);
    setPhase(state.status);
  }, []);

  const resume = useCallback(async () => {
    if (spectator) {
      const res = await request("spectator:join", { code });
      if (!res.ok) {
        setError(res.error || "Room not found. It may have ended.");
        setPhase("error");
        return;
      }
      applyState(res.state);
      return;
    }
    if (!seat?.hostToken) {
      setError("This browser is not the host of this room. Open the room on the device that created it, or use the projector view.");
      setPhase("error");
      return;
    }
    const res = await request("host:resume", { code, hostToken: seat.hostToken });
    if (!res.ok) {
      if (res.reason === "timeout") {
        setError("The server is taking a moment. Retrying.");
        return;
      }
      setError(res.error || "Room not found. It may have expired.");
      setPhase("error");
      return;
    }
    setError("");
    applyState(res.state);
  }, [code, seat, spectator, applyState]);

  useEffect(() => {
    resume();
    socket.on("connect", resume);
    return () => socket.off("connect", resume);
  }, [resume]);

  useSocketEvents(
    {
      "room:lobby": (l) => setLobby(l),
      "question:start": (q) => {
        setQuestion({ ...q, endsAt: Date.now() + q.remainingMs });
        setProgress({ answeredCount: q.answeredCount, playerCount: q.playerCount });
        if (q.leaderboard) setStandings(q.leaderboard);
        setReveal(null);
        setError("");
        setPhase("question");
      },
      "question:progress": (p) => setProgress({ answeredCount: p.answeredCount, playerCount: p.playerCount }),
      "question:reveal": (r) => {
        setReveal(withAutoNext(r));
        setStandings(r.leaderboard || []);
        setPhase("reveal");
      },
      "room:auto": (a) => setReveal((prev) => (prev ? withAutoNext({ ...prev, autoAdvance: a.autoAdvance, autoNextMs: a.autoNextMs }) : prev)),
      "game:end": (e) => {
        setEnd(e);
        setPhase("ended");
      },
      "player:flag": (f) => setFlags((prev) => ({ ...prev, [f.id]: f.tabSwitches })),
      "room:closed": () => {
        setError("This room has closed.");
        setPhase("error");
      },
    },
    [code],
  );

  const act = useCallback(
    async (event, extra = {}) => {
      if (spectator || inflight.current) return { ok: false };
      inflight.current = true;
      setBusy(true);
      setError("");
      const res = await request(event, { code, hostToken: seat?.hostToken, ...extra });
      inflight.current = false;
      setBusy(false);
      if (!res.ok) setError(res.error || "That did not work. Try again.");
      return res;
    },
    [code, seat, spectator],
  );

  useEffect(() => {
    if (spectator) return undefined;
    const onKey = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (phase === "reveal" && (e.key === "Enter" || e.key === "ArrowRight")) act("host:next");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, act, spectator]);

  const endGame = () => {
    if (window.confirm("End the game now and show results?")) act("host:end");
  };

  if (phase === "loading") {
    return (
      <Shell wide nav={false}>
        <Spinner label="Opening room" />
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell wide>
        <Banner tone="bad">{error}</Banner>
        <div className="mt-4 flex gap-2">
          <Link to="/host">
            <Button variant="secondary">Host a new game</Button>
          </Link>
          {!spectator ? (
            <Link to={`/watch/${code}`}>
              <Button variant="ghost">Open projector view</Button>
            </Link>
          ) : null}
        </div>
      </Shell>
    );
  }

  return (
    <Shell wide nav={false}>
      {spectator ? (
        <p className="mb-4 text-center">
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted">Projector view, room {code}</span>
        </p>
      ) : null}
      {error ? (
        <Banner tone="bad" className="mb-4">
          {error}
        </Banner>
      ) : null}
      {phase === "lobby" && lobby ? (
        <LobbyView lobby={lobby} code={code} spectator={spectator} busy={busy} onStart={() => act("host:start")} onKick={(id) => act("host:kick", { playerId: id })} onUpdate={(patch) => act("host:update", patch)} />
      ) : null}
      {!spectator && ((phase === "question" && question) || (phase === "reveal" && reveal)) ? (
        <ControlRoom
          phase={phase}
          question={question}
          reveal={reveal}
          progress={progress}
          standings={standings}
          flags={flags}
          busy={busy}
          onClose={() => act("host:close")}
          onNext={() => act("host:next")}
          onAuto={(enabled) => act("host:auto", { enabled })}
          onEnd={endGame}
        />
      ) : null}
      {spectator && phase === "question" && question ? <QuestionView question={question} progress={progress} /> : null}
      {spectator && phase === "reveal" && reveal ? <RevealView reveal={reveal} /> : null}
      {phase === "ended" && end ? <EndView end={end} code={code} spectator={spectator} /> : null}
    </Shell>
  );
}

function CodeBlock({ code, lobby }) {
  const url = joinUrl(code);
  return (
    <div className="relative overflow-hidden rounded-card bg-brand-gradient p-6 text-white shadow-pop md:p-8">
      <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 opacity-50" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rotate-12 rounded-[24px] bg-accent/90" />
      <div className="relative flex flex-col items-center text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-onblue">Join at</p>
        <p className="mt-1 text-xl font-bold md:text-2xl">{url.replace(/^https?:\/\//, "")}</p>
        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.14em] text-onblue">Room code</p>
        <p className="display mt-1 text-[64px] font-extrabold leading-none tracking-[0.18em] lg:text-8xl" aria-label={`Room code ${code.split("").join(" ")}`}>
          {code}
        </p>
        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.14em] text-onblue">Or scan</p>
        <div className="mt-2 inline-block rounded-card bg-white p-4 shadow-card">
          <QRCodeSVG value={url} size={200} aria-label="QR code to join" />
        </div>
        <p className="mt-5 text-sm font-semibold text-onblue">
          {lobby.setTitle} / {lobby.questionCount} questions / {lobby.settings.questionTime} s each
          {lobby.settings.difficulty && lobby.settings.difficulty !== "mixed" ? ` / ${lobby.settings.difficulty} only` : ""}
        </p>
        <p className="mt-1 text-xs text-onblue">{lobby.scoring.text}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {lobby.settings.examMode ? <Badge tone="accent">Exam mode: negative marking</Badge> : null}
          {lobby.setAi ? <Badge tone="white">Questions written by AI</Badge> : null}
          <Badge tone="white">{lobby.settings.autoAdvance ? "Auto-advance on" : "Host advances manually"}</Badge>
        </div>
      </div>
    </div>
  );
}

function LobbyView({ lobby, code, spectator, busy, onStart, onKick, onUpdate }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <CodeBlock code={code} lobby={lobby} />
      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h1 className="display text-3xl font-bold">
              <span key={lobby.players.length} className="pop inline-block text-brand-ink tabular">
                {lobby.players.length}
              </span>{" "}
              {lobby.players.length === 1 ? "player" : "players"} in
            </h1>
            {!spectator ? (
              <Button size="lg" onClick={onStart} disabled={busy || lobby.players.length === 0}>
                Start game
              </Button>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">{lobby.college}. Names show up here as people join.</p>
          {lobby.players.length === 0 ? (
            <p className="mt-8 flex items-center justify-center gap-2 text-sm font-bold text-muted">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-brand-600" aria-hidden="true" />
              Waiting for the first player
            </p>
          ) : (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Players">
              {lobby.players.map((p) => (
                <li key={p.id} className={`pop flex items-center gap-2 rounded-full border px-4 py-2 text-base font-bold ${p.connected ? "border-line bg-surface" : "border-dashed border-line text-muted"}`}>
                  {p.name}
                  {!p.connected ? <span className="text-xs font-normal">(away)</span> : null}
                  {!spectator ? (
                    <button type="button" onClick={() => onKick(p.id)} className="ml-1 rounded-full px-1 text-xs text-muted hover:bg-bad-bg hover:text-bad-ink" aria-label={`Remove ${p.name}`}>
                      &#10005;
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {!spectator ? (
          <Card>
            <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left" aria-expanded={open}>
              <span className="display text-lg font-bold">Room settings</span>
              <span className="text-sm font-bold text-brand-ink">{open ? "Hide" : "Change"}</span>
            </button>
            {open ? <SettingsPanel lobby={lobby} onUpdate={onUpdate} busy={busy} /> : <p className="mt-1 text-sm text-muted">Change the questions, the time, exam mode or auto-advance before you start.</p>}
            <p className="mt-4 text-xs text-muted">
              Want it on a projector? Open <span className="font-bold text-ink">{`${window.location.host}/watch/${code}`}</span> on that screen. It shows the game without the host buttons.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function SettingsPanel({ lobby, onUpdate, busy }) {
  const [sets, setSets] = useState(null);
  const [college, setCollege] = useState(lobby.college);
  useEffect(() => {
    api.get("/sets").then(setSets).catch(() => setSets([]));
  }, []);
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field id="lobby-set" label="Question set">
        <select id="lobby-set" className={inputClass} value={lobby.setId} onChange={(e) => onUpdate({ setId: e.target.value })} disabled={busy || !sets}>
          {(sets || [{ id: lobby.setId, title: lobby.setTitle, count: lobby.questionCount }]).map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.count} Qs)
            </option>
          ))}
        </select>
      </Field>
      <Field id="lobby-level" label="Level">
        <select id="lobby-level" className={inputClass} value={lobby.settings.difficulty || "mixed"} onChange={(e) => onUpdate({ difficulty: e.target.value })} disabled={busy}>
          {LEVEL_CHOICES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="lobby-time" label="Time per question">
        <select id="lobby-time" className={inputClass} value={lobby.settings.questionTime} onChange={(e) => onUpdate({ questionTime: Number(e.target.value) })} disabled={busy}>
          {TIME_CHOICES.filter((t) => t.value).map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
          {TIME_CHOICES.some((t) => t.value === lobby.settings.questionTime) ? null : <option value={lobby.settings.questionTime}>{lobby.settings.questionTime} s</option>}
        </select>
      </Field>
      <Field id="lobby-college" label="College">
        <div className="flex gap-2">
          <input id="lobby-college" className={inputClass} value={college} onChange={(e) => setCollege(e.target.value)} maxLength={60} />
          <Button variant="secondary" onClick={() => onUpdate({ college: college.trim() })} disabled={busy || !college.trim() || college.trim() === lobby.college}>
            Save
          </Button>
        </div>
      </Field>
      <div className="flex flex-col gap-3">
        <Toggle id="lobby-auto" compact checked={lobby.settings.autoAdvance} onChange={(v) => onUpdate({ autoAdvance: v })} title="Auto-advance" text="Next question starts 8 s after the answer is shown." />
        <Toggle id="lobby-exam" compact checked={lobby.settings.examMode} onChange={(v) => onUpdate({ examMode: v })} title="Exam mode" text="Wrong answers cost 250 points." />
      </div>
    </div>
  );
}

function StatusStrip({ phase, q, reveal, progress, standings }) {
  const connected = standings.filter((p) => p.connected !== false).length;
  const away = standings.length - connected;
  const pct = progress.playerCount ? Math.round((100 * progress.answeredCount) / progress.playerCount) : 0;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Question" value={`${q.qIndex + 1} of ${q.total}`} sub={`${topicLabel(q.topic)} / ${q.difficulty}`} />
      {phase === "question" ? (
        <Stat
          label="Answered"
          value={`${progress.answeredCount} of ${progress.playerCount}`}
          tone="brand"
          sub={
            <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%`, transition: "width 300ms" }} />
            </span>
          }
        />
      ) : (
        <Stat label="Correct" value={`${reveal.correctCount} of ${reveal.playerCount}`} tone="good" sub={`${reveal.answered} answered`} />
      )}
      {phase === "question" ? (
        <Stat label="Players" value={connected} sub={away ? `${away} away right now` : "all connected"} />
      ) : (
        <Stat label="Average time" value={seconds(reveal.avgElapsedMs)} sub="after network compensation" />
      )}
    </div>
  );
}

function OptionRows({ options, reveal }) {
  return (
    <ol className="mt-3 grid gap-1.5 sm:grid-cols-2" aria-label="Options">
      {options.map((opt, i) => {
        const correct = !!reveal && i === reveal.correct;
        const count = reveal ? reveal.counts[i] : null;
        const share = reveal && reveal.answered ? Math.round((100 * count) / reveal.answered) : 0;
        return (
          <li key={i} className={`relative overflow-hidden rounded-xl border px-3 py-2 text-sm ${correct ? "border-good bg-good-bg font-bold text-good-ink" : "border-line bg-card"}`}>
            {reveal ? <span aria-hidden="true" className={`absolute inset-y-0 left-0 ${correct ? "bg-good/15" : "bg-surface-2"}`} style={{ width: `${share}%` }} /> : null}
            <span className="relative flex items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-extrabold ${correct ? "bg-good text-white" : "bg-surface-2 text-muted"}`}>{LETTERS[i]}</span>
              <span className="min-w-0 flex-1 truncate">{opt}</span>
              {reveal ? (
                <span className="shrink-0 text-xs font-bold tabular text-muted">
                  {count} ({share}%)
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ControlRoom({ phase, question, reveal, progress, standings, flags, busy, onClose, onNext, onAuto, onEnd }) {
  const q = phase === "question" ? question : reveal;
  const flagged = phase === "reveal" ? standings.filter((p) => flags[p.id]) : [];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="flex flex-col gap-4">
        <StatusStrip phase={phase} q={q} reveal={reveal} progress={progress} standings={standings} />
        {phase === "question" ? <Timer endsAt={question.endsAt} durationMs={question.durationMs} /> : null}
        <Card className="border-l-4 border-l-brand-700">
          <QuestionBody text={q.text} table={q.table} image={q.image} size="md" />
          <OptionRows options={q.options} reveal={phase === "reveal" ? reveal : null} />
        </Card>
        {phase === "reveal" && reveal.explanation ? (
          <div className="rounded-card border-2 border-accent/40 bg-accent-soft p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-warm">Why</p>
            <p className="mt-1 text-sm text-ink">{reveal.explanation}</p>
          </div>
        ) : null}
        {flagged.length ? <Banner tone="warm">Left the tab during a question: {flagged.map((p) => `${p.name} (${flags[p.id]})`).join(", ")}</Banner> : null}
        {phase === "question" ? (
          <div className="flex flex-col gap-2">
            <Button variant="accent" size="lg" onClick={onClose} disabled={busy} className="w-full py-5 text-lg">
              End round now
            </Button>
            <p className="text-center text-xs text-muted">Closes the question for everyone and shows the answer. The round also ends on its own when the timer runs out or everyone has answered.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
            <Button size="lg" onClick={onNext} disabled={busy} className="w-full py-5 text-lg">
              {reveal.isLast ? "Show final results" : "Next question"}
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-muted">
              {reveal.autoAdvance && reveal.autoNextAt ? <Countdown endsAt={reveal.autoNextAt} prefix={reveal.isLast ? "Results in" : "Next question in"} className="text-ink" /> : <span>Auto-advance paused</span>}
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => onAuto(!reveal.autoAdvance)} className="rounded-full border border-line bg-card px-3 py-1 text-xs font-bold text-brand-ink hover:bg-brand-50" disabled={busy}>
                  {reveal.autoAdvance ? "Pause" : "Resume auto"}
                </button>
                <Button variant="ghost" size="sm" onClick={onEnd} disabled={busy}>
                  End game
                </Button>
              </span>
            </div>
          </div>
        )}
      </div>
      <Card className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-xl font-bold">Live standings</h2>
          <span className="text-xs font-bold text-muted">{phase === "reveal" ? "Just updated" : q.qIndex ? `After question ${q.qIndex}` : "Before the first question"}</span>
        </div>
        <p className="mb-3 text-xs text-muted">
          {standings.length} {standings.length === 1 ? "player" : "players"}. Arrows show who moved.
        </p>
        <div className="max-h-[70vh] overflow-auto pr-1">
          <Leaderboard entries={standings} limit={60} dense />
        </div>
      </Card>
    </div>
  );
}

function QuestionView({ question, progress }) {
  const pct = progress.playerCount ? Math.round((100 * progress.answeredCount) / progress.playerCount) : 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="brand">
            Question {question.qIndex + 1} of {question.total}
          </Badge>
          <Badge>{topicLabel(question.topic)}</Badge>
          <Badge>{question.difficulty}</Badge>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-2xl font-extrabold tabular">
            {progress.answeredCount} / {progress.playerCount} answered
          </span>
          <span className="h-2 w-40 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%`, transition: "width 300ms" }} />
          </span>
        </div>
      </div>
      <Timer endsAt={question.endsAt} durationMs={question.durationMs} size="lg" />
      <Card className="border-l-8 border-l-brand-700 p-6 md:p-8 lg:p-10">
        <QuestionBody text={question.text} table={question.table} image={question.image} size="lg" />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {question.options.map((opt, i) => (
          <OptionTile key={`${question.qIndex}-${i}`} index={i} text={opt} size="lg" delay={i * 70} />
        ))}
      </div>
    </div>
  );
}

function RevealView({ reveal }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone="brand">
            Question {reveal.qIndex + 1} of {reveal.total}
          </Badge>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Correct" value={`${reveal.correctCount} of ${reveal.playerCount}`} tone="good" className="animate-rise py-3" />
            <Stat label="Average time" value={seconds(reveal.avgElapsedMs)} className="animate-rise py-3" />
          </div>
        </div>
        <Card className="border-l-8 border-l-brand-700">
          <QuestionBody text={reveal.text} size="md" />
        </Card>
        <div className="grid gap-3 md:grid-cols-2">
          {reveal.options.map((opt, i) => (
            <OptionTile key={`r-${reveal.qIndex}-${i}`} index={i} text={opt} state={i === reveal.correct ? "correct" : "dim"} count={reveal.counts[i]} total={reveal.answered} />
          ))}
        </div>
        {reveal.explanation ? (
          <div className="rounded-card border-2 border-accent/40 bg-accent-soft p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-warm">Why</p>
            <p className="mt-1 text-base text-ink">{reveal.explanation}</p>
          </div>
        ) : null}
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm font-bold text-muted">
          {reveal.autoAdvance && reveal.autoNextAt ? <Countdown endsAt={reveal.autoNextAt} prefix={reveal.isLast ? "Results in" : "Next question in"} className="text-ink" /> : "Waiting for the host"}
        </p>
      </div>
      <Card className="animate-rise">
        <h2 className="display text-2xl font-bold">Live standings</h2>
        <p className="mb-4 text-sm text-muted">Top 10 of {reveal.leaderboard.length}. Arrows show who moved up or down.</p>
        <Leaderboard entries={reveal.leaderboard} limit={10} />
      </Card>
    </div>
  );
}

const podiumOrder = ["sm:order-2 sm:-translate-y-4", "sm:order-1", "sm:order-3"];
const podiumDelay = [0.5, 0.25, 0];

function EndView({ end, code, spectator }) {
  const [tab, setTab] = useState("questions");
  const board = end.leaderboard;
  const insights = end.insights;
  const podium = board.slice(0, 3);
  const tabs = spectator
    ? [
        ["questions", "Questions"],
        ["topics", "Topics"],
      ]
    : [
        ["questions", "Questions"],
        ["topics", "Topics"],
        ["players", "Players"],
        ["fairness", "Fairness"],
      ];

  const exportCsv = () => {
    const rows = [["Rank", "Name", "Score", "Correct", "Wrong", "Skipped", "Accuracy %", "Avg speed (s)", "Best topic", "Weakest topic", "Tab switches"]];
    for (const p of insights.players || []) {
      rows.push([p.rank, p.name, p.score, p.correct, p.wrong, p.skipped, p.accuracy, p.avgSpeedS ?? "", p.bestTopic ? topicLabel(p.bestTopic) : "", p.weakestTopic ? topicLabel(p.weakestTopic) : "", p.tabSwitches ?? 0]);
    }
    rows.push([]);
    rows.push(["Question", "Topic", "Difficulty", "Correct %", "Avg time (s)", "Correct option", "Answers per option"]);
    for (const q of insights.questions) rows.push([q.text, q.topic, q.difficulty, q.pctCorrect, q.avgElapsedMs ? (q.avgElapsedMs / 1000).toFixed(1) : "", q.options[q.correct], q.counts.join(" | ")]);
    downloadCsv(`aptiquiz-${code}.csv`, rows);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-ink">
            {insights.setTitle} / {insights.college}
          </p>
          <h1 className="display mt-1 text-4xl font-extrabold">Final results</h1>
        </div>
        {!spectator ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCsv}>
              Export CSV
            </Button>
            <Link to="/host">
              <Button>Host another game</Button>
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        {podium.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: podiumDelay[i] }}
            className={`relative overflow-hidden rounded-card border p-5 ${podiumOrder[i]} ${i === 0 ? "border-0 bg-brand-gradient text-white shadow-pop" : i === 1 ? "border-line bg-surface-2" : "border-line bg-card"}`}
          >
            {i === 0 ? <Confetti pieces={20} /> : null}
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className={`display flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${i === 0 ? "bg-accent text-ink" : i === 1 ? "bg-ink text-canvas" : "bg-muted text-white"}`}>{i + 1}</span>
                <p className={`text-[11px] font-extrabold uppercase tracking-[0.14em] ${i === 0 ? "text-onblue" : "text-muted"}`}>{["Winner", "Second", "Third"][i]}</p>
              </div>
              <p className={`display mt-4 truncate font-bold ${i === 0 ? "text-3xl lg:text-4xl" : "text-2xl"}`}>{p.name}</p>
              <p className={`text-2xl font-extrabold tabular ${i === 0 ? "text-accent" : "text-brand-ink"}`}>{p.score} pts</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <h2 className="display text-2xl font-bold">Standings</h2>
          <div className="mt-4">
            <Leaderboard entries={board} limit={60} showDelta={false} showLast={false} dense />
          </div>
        </Card>
        <Card>
          <Segmented options={tabs} value={tab} onChange={setTab} label="Insights" />
          <div className="mt-4" role="tabpanel">
            {tab === "questions" ? <QuestionInsights questions={insights.questions} /> : null}
            {tab === "topics" ? (
              <ul className="flex flex-col gap-3">
                {insights.topics.map((t) => (
                  <li key={t.topic}>
                    <div className="flex justify-between text-sm font-bold">
                      <span>{topicLabel(t.topic)}</span>
                      <span className="tabular">{t.accuracy}% correct</span>
                    </div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full bg-line">
                      <div className="h-full origin-left animate-grow rounded-full bg-brand-gradient" style={{ width: `${t.accuracy}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {tab === "players" && insights.players ? (
              <div className="max-h-[28rem] overflow-auto rounded-xl border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Accuracy</th>
                      <th className="px-3 py-2">Avg speed</th>
                      <th className="px-3 py-2">Best topic</th>
                      <th className="px-3 py-2">Weakest topic</th>
                      <th className="px-3 py-2">Tab left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.players.map((p) => (
                      <tr key={p.id} className="border-t border-line">
                        <td className="px-3 py-2 font-bold tabular">{p.rank}</td>
                        <td className="px-3 py-2 font-semibold">{p.name}</td>
                        <td className="px-3 py-2 tabular">{p.score}</td>
                        <td className="px-3 py-2 tabular">{p.accuracy}%</td>
                        <td className="px-3 py-2 tabular">{p.avgSpeedS ?? "-"} s</td>
                        <td className="px-3 py-2">{p.bestTopic ? topicLabel(p.bestTopic) : "-"}</td>
                        <td className="px-3 py-2">{p.weakestTopic ? topicLabel(p.weakestTopic) : "-"}</td>
                        <td className="px-3 py-2 tabular">{p.tabSwitches || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {tab === "fairness" && insights.fairness ? <FairnessPanel fairness={insights.fairness} /> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuestionInsights({ questions }) {
  return (
    <ol className="flex flex-col gap-3">
      {questions.map((q) => (
        <li key={q.index} className="rounded-xl border border-line p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-bold">
              {q.index + 1}. {q.text}
            </p>
            <Badge tone={q.pctCorrect >= 70 ? "good" : q.pctCorrect >= 40 ? "warm" : "bad"}>{q.pctCorrect}% correct</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {topicLabel(q.topic)} / {q.difficulty} / average {seconds(q.avgElapsedMs)} / answer: {q.options[q.correct]}
          </p>
        </li>
      ))}
    </ol>
  );
}

function FairnessPanel({ fairness }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Average connection delay" value={`${fairness.avgRttMs} ms`} sub="Round trip, measured by the server" />
        <Stat label="Slowest connection" value={`${fairness.maxRttMs} ms`} sub={`Compensation capped at ${fairness.rttCapMs} ms`} />
        <Stat label="Answers accepted" value={fairness.accepted} tone="good" />
        <Stat
          label="Rejected"
          value={fairness.rejectedLate + fairness.rejectedDuplicate + fairness.rejectedInvalid + (fairness.rejectedEarly || 0)}
          sub={`${fairness.rejectedLate} late, ${fairness.rejectedDuplicate} duplicate, ${fairness.rejectedEarly || 0} too early, ${fairness.rejectedInvalid} invalid`}
        />
      </div>
      <p className="text-sm text-muted">
        The server timed every round and scored every answer. Each player's measured round-trip delay was subtracted from their answer time, so two players who tapped at
        the same instant were scored the same even on different connections.
      </p>
    </div>
  );
}
