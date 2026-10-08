import test from "node:test";
import assert from "node:assert/strict";
import { AiError, buildPrompt, buildSet, describeAiError, describeStatus, generateQuestions } from "../server/ai.js";

const good = (n) => ({
  text: `What is ${n}% of 200?`,
  options: [String(n * 2), String(n * 2 + 1), String(n * 2 + 2), String(n * 2 + 3)],
  correct: 0,
  topic: "quantitative",
  difficulty: "easy",
  explanation: `${n}% of 200 is ${n * 2}.`,
});

const sample = {
  title: "Percentages practice",
  questions: [good(10), good(20), { ...good(30), options: ["60", "61", "62"] }, { ...good(40), correct: 7 }, { ...good(50), options: ["100", "100", "101", "102"] }, good(60)],
};

const reply = (content, finish_reason = "stop") => ({ choices: [{ finish_reason, message: { content } }] });

test("buildSet keeps only well-formed questions, caps at the requested count and labels the set", () => {
  const set = buildSet(sample, { topic: "Percentages", count: 2, difficulty: "mixed" });
  assert.equal(set.questions.length, 2);
  assert.equal(set.title, "Percentages practice");
  assert.match(set.description, /Written by AI/);
  assert.equal(set.questions[0].options.length, 4);
});

test("buildSet drops questions with the wrong option count, a bad answer index or repeated options", () => {
  const set = buildSet(sample, { topic: "Percentages", count: 10, difficulty: "hard" });
  assert.deepEqual(
    set.questions.map((q) => q.text),
    ["What is 10% of 200?", "What is 20% of 200?", "What is 60% of 200?"],
  );
});

test("buildSet refuses a set with too few usable questions", () => {
  assert.throws(() => buildSet({ title: "x", questions: [good(1)] }, { topic: "x", count: 5, difficulty: "mixed" }), AiError);
});

test("the prompt carries the count, the level, the topic and the JSON shape", () => {
  const { system, user } = buildPrompt({ topic: "Blood relations", count: 7, difficulty: "hard" });
  assert.match(system, /exactly 7 questions/);
  assert.match(system, /should be hard/);
  assert.match(system, /JSON only/);
  assert.equal(user, "Topic: Blood relations");
});

test("generateQuestions asks for JSON mode and reads the model's answer, even inside code fences", async () => {
  let request = null;
  const send = async (body) => {
    request = body;
    return reply("```json\n" + JSON.stringify(sample) + "\n```");
  };
  const set = await generateQuestions({ topic: "Percentages", count: 3, difficulty: "mixed" }, { send });
  assert.equal(request.response_format.type, "json_object");
  assert.equal(request.messages[1].content, "Topic: Percentages");
  assert.equal(set.questions.length, 3);
});

test("an empty, cut-off or unreadable answer becomes a plain error", async () => {
  const params = { topic: "Percentages", count: 3, difficulty: "mixed" };
  await assert.rejects(generateQuestions(params, { send: async () => ({ choices: [] }) }), /empty answer/);
  await assert.rejects(generateQuestions(params, { send: async () => reply("{", "length") }), /cut short/);
  await assert.rejects(generateQuestions(params, { send: async () => reply("not json") }), /could not be read/);
});

test("HTTP failures and unknown errors turn into plain sentences", () => {
  assert.match(describeStatus(401), /key/);
  assert.match(describeStatus(404), /model name/);
  assert.match(describeStatus(429), /free limit/);
  assert.match(describeStatus(503), /had a problem/);
  assert.equal(describeAiError(new AiError("Try a narrower topic.")), "Try a narrower topic.");
  assert.match(describeAiError(new Error("boom")), /went wrong/);
});
