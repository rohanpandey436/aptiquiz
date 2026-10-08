import { useEffect, useState } from "react";
import { Shell } from "../components/Layout.jsx";
import { Badge, Banner, Button, Card, Field, Spinner, inputClass } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { hostKey } from "../lib/storage.js";
import { LETTERS, topicLabel } from "../lib/format.js";

const TOPICS = ["quantitative", "logical", "verbal", "data interpretation"];
const DIFFICULTIES = ["easy", "medium", "hard"];

function blankQuestion() {
  return { text: "", options: ["", "", "", ""], correct: 0, topic: "quantitative", difficulty: "medium", explanation: "", image: "", tableText: "" };
}

function toEditable(q) {
  return { ...q, image: q.image || "", tableText: q.table ? q.table.map((r) => r.join(" | ")).join("\n") : "" };
}

function fromEditable(q) {
  const table = q.tableText.trim() ? q.tableText.split("\n").map((line) => line.split("|").map((c) => c.trim())) : null;
  const { tableText, ...rest } = q;
  return { ...rest, image: q.image.trim() || null, table };
}

export default function Sets() {
  const [unlocked, setUnlocked] = useState(!!hostKey.get());
  const [passcode, setPasscode] = useState("");
  const [sets, setSets] = useState(null);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/sets").then(setSets).catch((err) => setMessage({ tone: "bad", text: err.message }));

  useEffect(() => {
    if (unlocked) load();
  }, [unlocked]);

  const unlock = async (e) => {
    e.preventDefault();
    const res = await api.post("/host/verify", { passcode });
    if (!res.ok) return setMessage({ tone: "bad", text: "That passcode is not right." });
    hostKey.set(passcode);
    setMessage(null);
    setUnlocked(true);
  };

  const openEditor = async (id) => {
    setMessage(null);
    if (!id) return setEditing({ title: "", description: "", questionTime: 20, questions: [blankQuestion()] });
    try {
      const set = await api.get(`/sets/${id}`);
      setEditing({ ...set, questions: set.questions.map(toEditable) });
    } catch (err) {
      setMessage({ tone: "bad", text: err.message });
    }
  };

  const duplicate = async (id) => {
    setBusy(true);
    try {
      await api.post(`/sets/${id}/duplicate`);
      await load();
      setMessage({ tone: "good", text: "Set duplicated. Edit the copy to reuse it." });
    } catch (err) {
      setMessage({ tone: "bad", text: err.message });
    }
    setBusy(false);
  };

  const remove = async (set) => {
    if (!window.confirm(`Delete "${set.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.del(`/sets/${set.id}`);
      await load();
      setMessage({ tone: "good", text: "Set deleted." });
    } catch (err) {
      setMessage({ tone: "bad", text: err.message });
    }
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const payload = { ...editing, questions: editing.questions.map(fromEditable) };
      await api.post("/sets", payload);
      setEditing(null);
      await load();
      setMessage({ tone: "good", text: "Set saved. It is ready to host." });
    } catch (err) {
      setMessage({ tone: "bad", text: err.message });
    }
    setBusy(false);
  };

  if (!unlocked) {
    return (
      <Shell>
        <Card as="form" onSubmit={unlock} className="mx-auto max-w-md">
          <h1 className="text-2xl font-extrabold">Question editor</h1>
          <p className="mt-1 text-sm text-muted">Faculty and hosts can create, edit and reuse question sets. Enter the host passcode to continue.</p>
          <div className="mt-5 flex flex-col gap-4">
            <Field id="passcode" label="Host passcode">
              <input id="passcode" type="password" className={inputClass} value={passcode} onChange={(e) => setPasscode(e.target.value)} autoComplete="current-password" />
            </Field>
            {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
            <Button type="submit" size="lg">
              Unlock
            </Button>
          </div>
        </Card>
      </Shell>
    );
  }

  if (editing) {
    return (
      <Shell>
        <Editor set={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} busy={busy} message={message} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Question sets</h1>
          <p className="mt-1 text-muted">Build a set once, host it as many times as you like.</p>
        </div>
        <Button onClick={() => openEditor(null)}>New set</Button>
      </div>
      {message ? (
        <Banner tone={message.tone} className="mt-4">
          {message.text}
        </Banner>
      ) : null}
      {!sets ? (
        <div className="mt-6">
          <Spinner label="Loading sets" />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {sets.map((s) => (
            <Card as="li" key={s.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{s.title}</h2>
                  <p className="mt-1 text-sm text-muted">{s.description}</p>
                </div>
                <Badge tone={s.seed ? "brand" : "neutral"}>{s.seed ? "Built in" : "Custom"}</Badge>
              </div>
              <p className="mt-3 text-xs text-muted">
                {s.count} questions / {s.questionTime} s default /{" "}
                {Object.entries(s.topics)
                  .map(([t, n]) => `${topicLabel(t)} ${n}`)
                  .join(", ")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEditor(s.id)} disabled={busy}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => duplicate(s.id)} disabled={busy}>
                  Duplicate
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove(s)} disabled={busy}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function Editor({ set, onChange, onSave, onCancel, busy, message }) {
  const [active, setActive] = useState(0);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const questions = set.questions;

  const update = (patch) => onChange({ ...set, ...patch });
  const updateQuestion = (i, patch) => update({ questions: questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) });
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = questions.slice();
    [next[i], next[j]] = [next[j], next[i]];
    update({ questions: next });
    setActive(j);
  };
  const removeQuestion = (i) => {
    if (questions.length === 1) return;
    update({ questions: questions.filter((_, idx) => idx !== i) });
    setActive(Math.max(0, i - 1));
  };
  const addQuestion = () => {
    update({ questions: [...questions, blankQuestion()] });
    setActive(questions.length);
  };
  const importJson = () => {
    setImportError("");
    try {
      const parsed = JSON.parse(importText);
      const list = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(list) || !list.length) throw new Error("Expected a JSON array of questions");
      const cleaned = list.map((q) => toEditable({ ...blankQuestion(), ...q, options: Array.isArray(q.options) ? q.options.map(String) : ["", "", "", ""], correct: Number(q.correct) || 0 }));
      update({ questions: [...questions.filter((q) => q.text.trim()), ...cleaned] });
      setImportText("");
    } catch (err) {
      setImportError(err.message);
    }
  };

  const q = questions[active] || questions[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{set.id ? "Edit set" : "New set"}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? "Saving" : "Save set"}
          </Button>
        </div>
      </div>
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}

      <Card className="grid gap-4 md:grid-cols-[2fr_2fr_1fr]">
        <Field id="set-title" label="Title">
          <input id="set-title" className={inputClass} value={set.title} onChange={(e) => update({ title: e.target.value })} maxLength={80} />
        </Field>
        <Field id="set-desc" label="Description">
          <input id="set-desc" className={inputClass} value={set.description || ""} onChange={(e) => update({ description: e.target.value })} maxLength={200} />
        </Field>
        <Field id="set-time" label="Seconds per question">
          <input id="set-time" type="number" min={5} max={120} className={inputClass} value={set.questionTime} onChange={(e) => update({ questionTime: Number(e.target.value) })} />
        </Field>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{questions.length} questions</h2>
            <Button size="sm" variant="secondary" onClick={addQuestion}>
              Add
            </Button>
          </div>
          <ol className="mt-3 flex flex-col gap-1">
            {questions.map((item, i) => (
              <li key={i} className={`flex items-center gap-1 rounded-lg ${i === active ? "bg-brand-50" : ""}`}>
                <button type="button" onClick={() => setActive(i)} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm font-medium" aria-current={i === active ? "true" : undefined}>
                  {i + 1}. {item.text || "Untitled question"}
                </button>
                <button type="button" onClick={() => move(i, -1)} className="px-1.5 text-xs text-muted hover:text-ink" aria-label="Move up">
                  &#9650;
                </button>
                <button type="button" onClick={() => move(i, 1)} className="px-1.5 text-xs text-muted hover:text-ink" aria-label="Move down">
                  &#9660;
                </button>
                <button type="button" onClick={() => removeQuestion(i)} className="px-1.5 text-xs text-muted hover:text-bad" aria-label="Delete question">
                  &#10005;
                </button>
              </li>
            ))}
          </ol>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-brand-700">Import JSON</summary>
            <p className="mt-2 text-xs text-muted">Paste an array of questions with text, options, correct (index), topic, difficulty and optional explanation, image, table.</p>
            <textarea className={`${inputClass} mt-2 h-32 font-mono text-xs`} value={importText} onChange={(e) => setImportText(e.target.value)} aria-label="JSON to import" />
            {importError ? <p className="mt-1 text-xs font-semibold text-bad">{importError}</p> : null}
            <Button size="sm" variant="secondary" className="mt-2" onClick={importJson}>
              Add imported questions
            </Button>
          </details>
        </Card>

        {q ? (
          <Card className="flex flex-col gap-4">
            <Field id="q-text" label={`Question ${active + 1}`}>
              <textarea id="q-text" className={`${inputClass} min-h-24`} value={q.text} onChange={(e) => updateQuestion(active, { text: e.target.value })} maxLength={600} />
            </Field>
            <fieldset>
              <legend className="text-sm font-semibold">Options, tick the correct one</legend>
              <div className="mt-2 flex flex-col gap-2">
                {q.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name={`correct-${active}`} checked={q.correct === i} onChange={() => updateQuestion(active, { correct: i })} className="h-5 w-5 accent-brand-700" aria-label={`Option ${LETTERS[i]} is correct`} />
                    <span className="w-6 text-sm font-bold text-muted">{LETTERS[i]}</span>
                    <input className={inputClass} value={opt} onChange={(e) => updateQuestion(active, { options: q.options.map((o, idx) => (idx === i ? e.target.value : o)) })} maxLength={200} aria-label={`Option ${LETTERS[i]} text`} />
                    {q.options.length > 2 ? (
                      <button type="button" onClick={() => updateQuestion(active, { options: q.options.filter((_, idx) => idx !== i), correct: Math.min(q.correct, q.options.length - 2) })} className="px-1 text-muted hover:text-bad" aria-label={`Remove option ${LETTERS[i]}`}>
                        &#10005;
                      </button>
                    ) : null}
                  </div>
                ))}
                {q.options.length < 6 ? (
                  <Button size="sm" variant="ghost" className="self-start" onClick={() => updateQuestion(active, { options: [...q.options, ""] })}>
                    Add option
                  </Button>
                ) : null}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="q-topic" label="Topic">
                <select id="q-topic" className={inputClass} value={q.topic} onChange={(e) => updateQuestion(active, { topic: e.target.value })}>
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {topicLabel(t)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="q-diff" label="Difficulty">
                <select id="q-diff" className={inputClass} value={q.difficulty} onChange={(e) => updateQuestion(active, { difficulty: e.target.value })}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field id="q-exp" label="Explanation shown after the reveal" hint="Optional, but players learn more from it than from the score.">
              <textarea id="q-exp" className={`${inputClass} min-h-20`} value={q.explanation || ""} onChange={(e) => updateQuestion(active, { explanation: e.target.value })} maxLength={600} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="q-img" label="Image URL" hint="Optional. https link to a diagram or chart.">
                <input id="q-img" className={inputClass} value={q.image} onChange={(e) => updateQuestion(active, { image: e.target.value })} maxLength={500} />
              </Field>
              <Field id="q-table" label="Table" hint="Optional. One row per line, cells separated by |. First line is the header.">
                <textarea id="q-table" className={`${inputClass} min-h-20 font-mono text-xs`} value={q.tableText} onChange={(e) => updateQuestion(active, { tableText: e.target.value })} />
              </Field>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
