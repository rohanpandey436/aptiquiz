import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shell } from "../components/Layout.jsx";
import { Badge, Banner, Button, Card, Field, Spinner, inputClass } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { request } from "../lib/socket.js";
import { hostSeat } from "../lib/storage.js";
import { topicLabel } from "../lib/format.js";

const TIME_CHOICES = [
  { value: 0, label: "Set default" },
  { value: 10, label: "10 s" },
  { value: 15, label: "15 s" },
  { value: 20, label: "20 s" },
  { value: 30, label: "30 s" },
  { value: 45, label: "45 s" },
];

export default function HostCreate() {
  const navigate = useNavigate();
  const [sets, setSets] = useState(null);
  const [setId, setSetId] = useState("");
  const [college, setCollege] = useState("Lloyd Institute");
  const [questionTime, setQuestionTime] = useState(0);
  const [examMode, setExamMode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get("/sets")
      .then((list) => {
        setSets(list);
        if (list.length && !setId) setSetId(list[0].id);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await request("host:create", { setId, college: college.trim(), questionTime: questionTime || undefined, examMode });
    setBusy(false);
    if (!res.ok) return setError(res.error || "Could not create the room");
    hostSeat.set(res.code, { hostToken: res.hostToken });
    navigate(`/host/${res.code}`);
  };

  const chosen = sets?.find((s) => s.id === setId);

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold">Host a game</h1>
        <p className="mt-1 text-muted">Pick a question set, choose the pace, and you get a room code to put on the screen.</p>

        <form onSubmit={create} className="mt-6 flex flex-col gap-6">
          <Card>
            <h2 className="font-bold">Question set</h2>
            {!sets ? (
              <div className="mt-3">
                <Spinner label="Loading sets" />
              </div>
            ) : sets.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No sets yet. <Link to="/sets" className="font-semibold text-brand-700 underline">Create one</Link> first.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Question set">
                {sets.map((s) => {
                  const active = s.id === setId;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSetId(s.id)}
                      className={`rounded-2xl border-2 p-4 text-left transition-colors ${active ? "border-brand-700 bg-brand-50" : "border-line hover:border-brand-200"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold">{s.title}</span>
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
            <p className="mt-3 text-sm text-muted">
              Want your own questions? <Link to="/sets" className="font-semibold text-brand-700 underline">Open the question editor</Link>.
            </p>
          </Card>

          <Card className="grid gap-5 sm:grid-cols-2">
            <Field id="college" label="College" hint="Scores from this room count towards this college in the league.">
              <input id="college" className={inputClass} value={college} onChange={(e) => setCollege(e.target.value)} maxLength={60} required />
            </Field>
            <Field id="qtime" label="Time per question" hint={chosen ? `Set default is ${chosen.questionTime} s.` : ""}>
              <select id="qtime" className={inputClass} value={questionTime} onChange={(e) => setQuestionTime(Number(e.target.value))}>
                {TIME_CHOICES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 sm:col-span-2">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-brand-700" checked={examMode} onChange={(e) => setExamMode(e.target.checked)} />
              <span>
                <span className="font-semibold">Exam mode: negative marking</span>
                <span className="block text-sm text-muted">A wrong answer costs 250 points, like a real placement test. Skipping costs nothing. Players see this rule in the lobby.</span>
              </span>
            </label>
          </Card>

          {error ? <Banner tone="bad">{error}</Banner> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" disabled={!setId || busy}>
              {busy ? "Creating room" : "Create room"}
            </Button>
            <span className="text-sm text-muted">You can start the game once the first player joins.</span>
          </div>
        </form>
      </div>
    </Shell>
  );
}
