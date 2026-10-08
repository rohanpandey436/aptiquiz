import { useState } from "react";
import { Badge, Banner, Button, Segmented, Spinner, inputClass } from "./ui.jsx";
import { api } from "../lib/api.js";
import { LETTERS, topicLabel } from "../lib/format.js";

const COUNTS = [
  ["5", "5 questions"],
  ["10", "10 questions"],
  ["15", "15 questions"],
];

const LEVELS = [
  ["mixed", "Mixed"],
  ["easy", "Easy"],
  ["medium", "Medium"],
  ["hard", "Hard"],
];

const IDEAS = ["Percentages", "Time and work", "Blood relations", "Number series", "Synonyms", "Pie charts"];

export function AiQuestions({ onUse, chosenId = null }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [level, setLevel] = useState("mixed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const generate = async () => {
    const clean = topic.trim();
    if (clean.length < 2) {
      setError("Type a topic first, such as Percentages or Blood relations.");
      return;
    }
    setError("");
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post("/sets/ai", { topic: clean, count: Number(count), difficulty: level });
      setResult(res);
      onUse(res);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!busy) generate();
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ai-topic" className="text-sm font-bold text-ink">
          Topic
        </label>
        <input
          id="ai-topic"
          className={inputClass}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Percentages, blood relations, synonyms..."
          maxLength={80}
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>Try</span>
          {IDEAS.map((idea) => (
            <button key={idea} type="button" onClick={() => setTopic(idea)} className="rounded-full border border-line bg-card px-2.5 py-0.5 font-bold text-brand-ink hover:bg-brand-50" disabled={busy}>
              {idea}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">How many</span>
          <Segmented options={COUNTS} value={count} onChange={setCount} label="How many questions" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Level</span>
          <Segmented options={LEVELS} value={level} onChange={setLevel} label="Level" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={generate} disabled={busy || topic.trim().length < 2}>
          {busy ? "Writing" : result ? "Write a new set" : "Write questions"}
        </Button>
        <span className="text-sm text-muted">AI writes the questions and answers, and only those are played. Read them before anyone plays.</span>
      </div>
      {busy ? <Spinner label={`Writing ${count} questions on ${topic.trim()}. This takes about half a minute.`} /> : null}
      {error ? (
        <Banner tone="bad">
          <span className="flex flex-wrap items-center gap-3">
            {error}
            <Button size="sm" variant="secondary" onClick={generate}>
              Try again
            </Button>
          </span>
        </Banner>
      ) : null}
      {result ? <Preview set={result.set} selected={result.set.id === chosenId} /> : null}
    </div>
  );
}

function Preview({ set, selected }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="display text-lg font-bold">{set.title}</p>
          <p className="text-xs text-muted">
            {set.questions.length} questions. AI can make mistakes, so check each answer below.
          </p>
        </div>
        {selected ? <Badge tone="good">Ready. Only these questions will be played.</Badge> : null}
      </div>
      <ol className="flex max-h-[30rem] flex-col gap-2 overflow-auto pr-1" aria-label="Questions written by AI">
        {set.questions.map((q, i) => (
          <li key={q.id || i} className="rounded-xl border border-line bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold">
                {i + 1}. {q.text}
              </p>
              <span className="flex shrink-0 gap-1">
                <Badge>{topicLabel(q.topic)}</Badge>
                <Badge>{q.difficulty}</Badge>
              </span>
            </div>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {q.options.map((opt, j) => (
                <li key={j} className={`rounded-lg px-2 py-1 ${j === q.correct ? "bg-good-bg font-bold text-good-ink" : "text-muted"}`}>
                  {LETTERS[j]}. {opt}
                  {j === q.correct ? " (correct)" : ""}
                </li>
              ))}
            </ul>
            {q.explanation ? <p className="mt-2 text-xs text-muted">Why: {q.explanation}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
