import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shell } from "../components/Layout.jsx";
import { Badge, Banner, Button, Card, Field, Segmented, Spinner, inputClass } from "../components/ui.jsx";
import { LEVEL_CHOICES, TIME_CHOICES, Toggle } from "../components/RoomSettings.jsx";
import { api } from "../lib/api.js";
import { request } from "../lib/socket.js";
import { hostSeat } from "../lib/storage.js";
import { topicLabel } from "../lib/format.js";
import { QUICK_EXAMPLE, parseQuickQuestions } from "../lib/quickParse.js";
import { AiQuestions } from "../components/AiQuestions.jsx";

const SOURCES = [
  ["builtin", "Built-in sets"],
  ["own", "Write your own"],
];
const AI_SOURCE = ["ai", "Ask AI"];

export default function HostCreate() {
  const navigate = useNavigate();
  const [source, setSource] = useState("builtin");
  const [aiOn, setAiOn] = useState(false);
  const [aiSet, setAiSet] = useState(null);
  const [sets, setSets] = useState(null);
  const [setId, setSetId] = useState("");
  const [ownTitle, setOwnTitle] = useState("");
  const [ownText, setOwnText] = useState("");
  const [college, setCollege] = useState("Lloyd Institute");
  const [questionTime, setQuestionTime] = useState(0);
  const [difficulty, setDifficulty] = useState("mixed");
  const [examMode, setExamMode] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
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
        if (list.length) setSetId((current) => current || list[0].id);
      })
      .catch((err) => {
        setSets([]);
        setError(err.message);
      });
  };

  useEffect(loadSets, []);
  useEffect(() => {
    api
      .get("/config")
      .then((c) => setAiOn(!!c.ai))
      .catch(() => {});
  }, []);

  const useAiSet = ({ set, summary }) => {
    setSets((list) => [summary, ...(list || []).filter((s) => s.id !== summary.id)]);
    setAiSet(set);
  };

  const parsed = useMemo(() => parseQuickQuestions(ownText), [ownText]);
  const ownReady = source === "own" && parsed.count > 0 && parsed.errors.length === 0;
  const canCreate = source === "builtin" ? !!setId : source === "ai" ? !!aiSet : ownReady;

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let chosenSetId = source === "ai" ? aiSet.id : setId;
      if (source === "own") {
        const saved = await api.post("/sets", { title: ownTitle.trim() || "My questions", questionTime: questionTime || 20, questions: parsed.questions });
        chosenSetId = saved.id;
      }
      const res = await request("host:create", { setId: chosenSetId, college: college.trim(), questionTime: questionTime || undefined, examMode, autoAdvance, difficulty });
      if (!res.ok) throw new Error(res.error || "Could not create the room");
      hostSeat.set(res.code, { hostToken: res.hostToken });
      navigate(`/host/${res.code}`);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const chosen = sets?.find((s) => s.id === setId);

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-ink">Host</p>
        <h1 className="display mt-2 text-4xl font-extrabold">Host a game</h1>
        <p className="mt-2 text-muted">Pick questions, set the time, and get a room code for the big screen. You can still change settings in the lobby.</p>

        <form onSubmit={create} className="mt-8 flex flex-col gap-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="display text-xl font-bold">Questions</h2>
              <Segmented options={aiOn ? [...SOURCES, AI_SOURCE] : SOURCES} value={source} onChange={setSource} label="Question source" />
            </div>

            {source === "builtin" ? (
              !sets ? (
                <div className="mt-4">
                  <Spinner label="Loading sets" />
                </div>
              ) : sets.length === 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p className="text-sm text-muted">{error ? "The sets could not be loaded." : 'No sets yet. Switch to "Write your own".'}</p>
                  {error ? (
                    <Button size="sm" variant="secondary" onClick={loadSets}>
                      Try again
                    </Button>
                  ) : null}
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
                          <span className="flex shrink-0 gap-1">
                            {s.ai ? <Badge tone="warm">AI</Badge> : null}
                            <Badge tone={active ? "brand" : "neutral"}>{s.count} Qs</Badge>
                          </span>
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
              )
            ) : source === "ai" ? (
              <AiQuestions onUse={useAiSet} chosenId={aiSet?.id} />
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                <Field id="own-title" label="Set name">
                  <input id="own-title" className={inputClass} value={ownTitle} onChange={(e) => setOwnTitle(e.target.value)} placeholder="Friday practice" maxLength={80} />
                </Field>
                <Field id="own-text" label="Questions, written plainly" hint='Write a question, then its options like "A) 30", then "Answer: B". Leave an empty line between questions. Optional: "Topic: logical" and "Why: ...".'>
                  <textarea id="own-text" className={`${inputClass} min-h-56 font-mono text-sm`} value={ownText} onChange={(e) => setOwnText(e.target.value)} placeholder={QUICK_EXAMPLE} spellCheck={false} />
                </Field>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {parsed.count === 0 ? (
                    <span className="text-muted">Type your questions, or</span>
                  ) : parsed.errors.length ? (
                    <Badge tone="bad">
                      {parsed.count} {parsed.count === 1 ? "question" : "questions"}, {parsed.errors.length} to fix
                    </Badge>
                  ) : (
                    <Badge tone="good">
                      {parsed.count} {parsed.count === 1 ? "question" : "questions"} ready
                    </Badge>
                  )}
                  {parsed.count === 0 ? (
                    <button type="button" className="font-bold text-brand-ink underline" onClick={() => setOwnText(QUICK_EXAMPLE)}>
                      paste the example
                    </button>
                  ) : null}
                  <Link to="/sets" className="ml-auto font-bold text-brand-ink underline">
                    Need images or tables? Open the full editor
                  </Link>
                </div>
                {parsed.errors.length ? (
                  <ul className="rounded-xl bg-bad-bg px-4 py-3 text-sm font-semibold text-bad-ink">
                    {parsed.errors.slice(0, 4).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </Card>

          <Card ref={settingsRef} className="grid scroll-mt-20 gap-5 sm:grid-cols-2">
            <Field id="college" label="College" hint="Scores from this room count towards this college in the league.">
              <input id="college" className={inputClass} value={college} onChange={(e) => setCollege(e.target.value)} maxLength={60} required />
            </Field>
            <Field id="qtime" label="Time per question" hint={source === "builtin" && chosen ? `Set default is ${chosen.questionTime} s.` : "Default is 20 s."}>
              <select id="qtime" className={inputClass} value={questionTime} onChange={(e) => setQuestionTime(Number(e.target.value))}>
                {TIME_CHOICES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="level" label="Level" hint="Easy, medium or hard keeps only those questions from the set.">
              <select id="level" className={inputClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {LEVEL_CHOICES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="hidden sm:block" />
            <Toggle id="auto" checked={autoAdvance} onChange={setAutoAdvance} title="Auto-advance" text="The next question starts on its own 8 seconds after the answer is shown. You can still press Next or pause." />
            <Toggle id="exam" checked={examMode} onChange={setExamMode} title="Exam mode (negative marking)" text="A wrong answer costs 250 points, like a real placement test. Players see this in the lobby." />
          </Card>

          {error ? <Banner tone="bad">{error}</Banner> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={!canCreate || busy}>
              {busy ? "Creating room" : "Create room"}
            </Button>
            <span className="text-sm text-muted">
              {source === "ai"
                ? aiSet
                  ? `The room will play only "${aiSet.title}", ${aiSet.questions.length} questions written by AI.`
                  : "Write questions with AI first."
                : source === "own"
                  ? "Your questions are saved so you can use them again."
                  : "You can start as soon as the first player joins."}
            </span>
          </div>
        </form>
      </div>
    </Shell>
  );
}
