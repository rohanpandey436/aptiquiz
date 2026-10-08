import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Shell } from "../components/Layout.jsx";
import { Badge, Banner, Button, Card, Spinner, Stat } from "../components/ui.jsx";
import { Timer } from "../components/Timer.jsx";
import { OptionTile } from "../components/OptionTile.jsx";
import { Leaderboard } from "../components/Leaderboard.jsx";
import { QuestionBody } from "../components/QuestionBody.jsx";
import { request, socket, useSocketEvents } from "../lib/socket.js";
import { hostSeat } from "../lib/storage.js";
import { downloadCsv, joinUrl, seconds, topicLabel } from "../lib/format.js";

export default function HostRoom() {
  const { code } = useParams();
  const seat = useMemo(() => hostSeat.get(code), [code]);
  const [phase, setPhase] = useState("loading");
  const [lobby, setLobby] = useState(null);
  const [question, setQuestion] = useState(null);
  const [progress, setProgress] = useState({ answeredCount: 0, playerCount: 0 });
  const [reveal, setReveal] = useState(null);
  const [end, setEnd] = useState(null);
  const [flags, setFlags] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const applyState = useCallback((state) => {
    if (state.lobby) setLobby(state.lobby);
    if (state.status === "question") {
      setQuestion({ ...state.question, endsAt: Date.now() + state.question.remainingMs });
      setProgress({ answeredCount: state.question.answeredCount, playerCount: state.question.playerCount });
    }
    if (state.status === "reveal") setReveal(state.reveal);
    if (state.status === "ended") setEnd(state.end);
    setPhase(state.status);
  }, []);

  const resume = useCallback(async () => {
    if (!seat?.hostToken) {
      setError("This browser is not the host of this room. Open the room on the device that created it.");
      setPhase("error");
      return;
    }
    const res = await request("host:resume", { code, hostToken: seat.hostToken });
    if (!res.ok) {
      setError(res.error || "Room not found. It may have expired.");
      setPhase("error");
      return;
    }
    applyState(res.state);
  }, [code, seat, applyState]);

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
        setReveal(null);
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
      "player:flag": (f) => setFlags((prev) => ({ ...prev, [f.id]: f.tabSwitches })),
    },
    [code],
  );

  const act = async (event) => {
    setBusy(true);
    const res = await request(event, { code, hostToken: seat?.hostToken });
    setBusy(false);
    if (!res.ok) setError(res.error || "That did not work");
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (phase === "reveal" && (e.key === "Enter" || e.key === "ArrowRight")) act("host:next");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, code]);

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
        <Link to="/host" className="mt-4 inline-block">
          <Button variant="secondary">Host a new game</Button>
        </Link>
      </Shell>
    );
  }

  return (
    <Shell wide nav={false}>
      {error ? (
        <Banner tone="bad" className="mb-4">
          {error}
        </Banner>
      ) : null}
      {phase === "lobby" && lobby ? <LobbyView lobby={lobby} code={code} onStart={() => act("host:start")} onKick={(id) => request("host:kick", { code, hostToken: seat.hostToken, playerId: id })} busy={busy} /> : null}
      {phase === "question" && question ? <QuestionView question={question} progress={progress} onClose={() => act("host:next")} busy={busy} /> : null}
      {phase === "reveal" && reveal ? <RevealView reveal={reveal} flags={flags} onNext={() => act("host:next")} onEnd={endGame} busy={busy} /> : null}
      {phase === "ended" && end ? <EndView end={end} flags={flags} code={code} /> : null}
    </Shell>
  );
}

function LobbyView({ lobby, code, onStart, onKick, busy }) {
  const url = joinUrl(code);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card className="flex flex-col items-center text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Join at</p>
        <p className="mt-1 text-lg font-bold text-brand-700">{url.replace(/^https?:\/\//, "")}</p>
        <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Room code</p>
        <p className="mt-1 text-6xl font-extrabold tracking-[0.2em] text-ink md:text-7xl" aria-label={`Room code ${code.split("").join(" ")}`}>
          {code}
        </p>
        <div className="mt-6 rounded-2xl border border-line p-3">
          <QRCodeSVG value={url} size={200} aria-label="QR code to join" />
        </div>
        <p className="mt-4 text-sm text-muted">{lobby.setTitle} / {lobby.questionCount} questions / {lobby.settings.questionTime} s each</p>
        <p className="mt-1 text-xs text-muted">{lobby.scoring.text}</p>
        {lobby.settings.examMode ? (
          <Badge tone="warm" className="mt-2">
            Exam mode: negative marking
          </Badge>
        ) : null}
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">
            {lobby.players.length} {lobby.players.length === 1 ? "player" : "players"} in
          </h1>
          <Button size="lg" onClick={onStart} disabled={busy || lobby.players.length === 0}>
            Start game
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted">{lobby.college}. Names appear here the moment someone joins.</p>
        {lobby.players.length === 0 ? (
          <p className="mt-8 text-center text-muted">Waiting for the first player</p>
        ) : (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Players">
            {lobby.players.map((p) => (
              <li key={p.id} className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${p.connected ? "border-line bg-surface" : "border-dashed border-line text-muted"}`}>
                {p.name}
                {!p.connected ? <span className="text-xs font-normal">(away)</span> : null}
                <button type="button" onClick={() => onKick(p.id)} className="ml-1 rounded-full px-1 text-xs text-muted hover:bg-bad-bg hover:text-bad" aria-label={`Remove ${p.name}`}>
                  &#10005;
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function QuestionView({ question, progress, onClose, busy }) {
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
        <div className="text-lg font-bold tabular">
          {progress.answeredCount} / {progress.playerCount} answered
        </div>
      </div>
      <Timer endsAt={question.endsAt} durationMs={question.durationMs} size="lg" />
      <Card className="md:p-8">
        <QuestionBody text={question.text} table={question.table} image={question.image} size="lg" />
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {question.options.map((opt, i) => (
          <OptionTile key={i} index={i} text={opt} size="lg" />
        ))}
      </div>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          End round now
        </Button>
      </div>
    </div>
  );
}

function RevealView({ reveal, flags, onNext, onEnd, busy }) {
  const flagged = reveal.leaderboard.filter((p) => flags[p.id]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone="brand">
            Question {reveal.qIndex + 1} of {reveal.total}
          </Badge>
          <p className="text-sm font-semibold text-muted">
            {reveal.correctCount} of {reveal.playerCount} correct, average {seconds(reveal.avgElapsedMs)}
          </p>
        </div>
        <Card>
          <QuestionBody text={reveal.text} />
        </Card>
        <div className="grid gap-3 md:grid-cols-2">
          {reveal.options.map((opt, i) => (
            <OptionTile key={i} index={i} text={opt} state={i === reveal.correct ? "correct" : "dim"} count={reveal.counts[i]} total={reveal.answered} />
          ))}
        </div>
        {reveal.explanation ? (
          <Card className="bg-surface">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Why</p>
            <p className="mt-1 text-base">{reveal.explanation}</p>
          </Card>
        ) : null}
        {flagged.length ? (
          <Banner tone="warm">
            Left the tab during a question: {flagged.map((p) => `${p.name} (${flags[p.id]})`).join(", ")}
          </Banner>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="ghost" onClick={onEnd} disabled={busy}>
            End game
          </Button>
          <Button size="lg" onClick={onNext} disabled={busy}>
            {reveal.isLast ? "Show final results" : "Next question"}
          </Button>
        </div>
      </div>
      <Card>
        <h2 className="text-xl font-extrabold">Leaderboard</h2>
        <p className="mb-4 text-sm text-muted">Top 10 of {reveal.leaderboard.length}. Arrows show movement this round.</p>
        <Leaderboard entries={reveal.leaderboard} limit={10} />
      </Card>
    </div>
  );
}

function EndView({ end, flags, code }) {
  const [tab, setTab] = useState("questions");
  const board = end.leaderboard;
  const insights = end.insights;
  const podium = board.slice(0, 3);

  const exportCsv = () => {
    const rows = [["Rank", "Name", "Score", "Correct", "Wrong", "Skipped", "Accuracy %", "Avg speed (s)", "Tab switches"]];
    for (const p of insights.players) rows.push([p.rank, p.name, p.score, p.correct, p.wrong, p.skipped, p.accuracy, p.avgSpeedS ?? "", flags[p.id] ?? p.tabSwitches ?? 0]);
    rows.push([]);
    rows.push(["Question", "Topic", "Difficulty", "Correct %", "Avg time (s)", "Correct option", "Answers per option"]);
    for (const q of insights.questions) rows.push([q.text, q.topic, q.difficulty, q.pctCorrect, q.avgElapsedMs ? (q.avgElapsedMs / 1000).toFixed(1) : "", q.options[q.correct], q.counts.join(" | ")]);
    downloadCsv(`aptiquiz-${code}.csv`, rows);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">{insights.setTitle} / {insights.college}</p>
          <h1 className="text-3xl font-extrabold">Final results</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          <Link to="/host">
            <Button>Host another game</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {podium.map((p, i) => (
          <Card key={p.id} className={i === 0 ? "border-warm/50 bg-warm-bg/50" : ""}>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">{["Winner", "Second", "Third"][i]}</p>
            <p className="mt-1 truncate text-2xl font-extrabold">{p.name}</p>
            <p className="text-lg font-bold tabular text-brand-700">{p.score} pts</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <h2 className="text-xl font-extrabold">Standings</h2>
          <div className="mt-4">
            <Leaderboard entries={board} limit={50} showDelta={false} showLast={false} dense />
          </div>
        </Card>
        <Card>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Insights">
            {[
              ["questions", "Questions"],
              ["topics", "Topics"],
              ["players", "Players"],
              ["fairness", "Fairness"],
            ].map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === key ? "bg-brand-700 text-white" : "bg-surface text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4" role="tabpanel">
            {tab === "questions" ? <QuestionInsights questions={insights.questions} /> : null}
            {tab === "topics" ? (
              <ul className="flex flex-col gap-3">
                {insights.topics.map((t) => (
                  <li key={t.topic}>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>{topicLabel(t.topic)}</span>
                      <span className="tabular">{t.accuracy}% correct</span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${t.accuracy}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {tab === "players" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Score</th>
                      <th className="py-2 pr-3">Accuracy</th>
                      <th className="py-2 pr-3">Avg speed</th>
                      <th className="py-2 pr-3">Tab left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.players.map((p) => (
                      <tr key={p.name} className="border-t border-line">
                        <td className="py-2 pr-3 tabular">{p.rank}</td>
                        <td className="py-2 pr-3 font-semibold">{p.name}</td>
                        <td className="py-2 pr-3 tabular">{p.score}</td>
                        <td className="py-2 pr-3 tabular">{p.accuracy}%</td>
                        <td className="py-2 pr-3 tabular">{p.avgSpeedS ?? "-"} s</td>
                        <td className="py-2 pr-3 tabular">{p.tabSwitches || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {tab === "fairness" ? <FairnessPanel fairness={insights.fairness} /> : null}
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
            <p className="text-sm font-semibold">
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
        <Stat label="Rejected" value={fairness.rejectedLate + fairness.rejectedDuplicate + fairness.rejectedInvalid} sub={`${fairness.rejectedLate} late, ${fairness.rejectedDuplicate} duplicate, ${fairness.rejectedInvalid} invalid`} />
      </div>
      <p className="text-sm text-muted">
        The server timed every round and scored every answer. Each player's measured round-trip delay was subtracted from their answer time, so two players who tapped at
        the same instant were scored the same even on different connections.
      </p>
    </div>
  );
}
