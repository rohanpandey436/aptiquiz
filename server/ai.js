import { cleanText } from "./validate.js";

const BASE_URL = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const MODEL = process.env.AI_MODEL || "openai/gpt-oss-120b";
const TOPICS = ["quantitative", "logical", "verbal", "data interpretation"];
const LEVELS = ["easy", "medium", "hard"];
const MIN_USABLE = 3;
const MAX_IN_FLIGHT = 3;
const PER_ADDRESS_LIMIT = 12;
const PER_ADDRESS_WINDOW_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 90 * 1000;

export class AiError extends Error {}

export function aiEnabled() {
  return !!process.env.AI_API_KEY;
}

let inFlight = 0;
const recent = new Map();

export function reserveSlot(ip) {
  const now = Date.now();
  const entry = recent.get(ip);
  if (entry && entry.resetAt > now && entry.count >= PER_ADDRESS_LIMIT) {
    return { ok: false, error: "You have asked AI for a lot of questions this hour. Try again later." };
  }
  if (inFlight >= MAX_IN_FLIGHT) return { ok: false, error: "AI is writing questions for other hosts right now. Try again in a minute." };
  recent.set(ip, entry && entry.resetAt > now ? { count: entry.count + 1, resetAt: entry.resetAt } : { count: 1, resetAt: now + PER_ADDRESS_WINDOW_MS });
  inFlight++;
  return { ok: true, release: () => (inFlight = Math.max(0, inFlight - 1)) };
}

export function buildPrompt({ topic, count, difficulty }) {
  const level = difficulty === "mixed" ? "Spread the questions across easy, medium and hard." : `Every question should be ${difficulty}.`;
  const system = [
    "You write multiple-choice aptitude questions for Indian campus placement preparation, in the style of TCS, Infosys, Wipro and CAT screening tests.",
    `Write exactly ${count} questions on the topic the user gives.`,
    "Each question has exactly 4 options with exactly one correct answer; the other three must be plausible and all four must be different. Vary the position of the correct option.",
    "Check every calculation before you answer. The numbers must work out exactly.",
    level,
    "Use plain English and short sentences. No trick wording, no images, no tables.",
    "Set the questions in India: money in rupees written as Rs, Indian names and places.",
    "Reply with JSON only, no prose and no code fences, in exactly this shape:",
    '{"title": "short set name, at most 40 characters", "questions": [{"text": "the question", "options": ["A", "B", "C", "D"], "correct": 0, "topic": "quantitative", "difficulty": "easy", "explanation": "one or two sentences showing how to reach the answer"}]}',
    '"correct" is the index of the right option, 0 to 3. "topic" is one of: quantitative, logical, verbal, data interpretation. "difficulty" is one of: easy, medium, hard.',
  ].join("\n");
  return { system, user: `Topic: ${topic}` };
}

export function buildSet(data, { topic, count, difficulty }) {
  const usable = [];
  for (const raw of Array.isArray(data?.questions) ? data.questions : []) {
    const text = cleanText(raw?.text, 600, { multiline: true });
    const options = Array.isArray(raw?.options) ? raw.options.map((o) => cleanText(String(o ?? ""), 200)).filter(Boolean) : [];
    const correct = Number(raw?.correct);
    const distinct = new Set(options.map((o) => o.toLowerCase())).size === options.length;
    if (!text || options.length !== 4 || !distinct || !Number.isInteger(correct) || correct < 0 || correct > 3) continue;
    usable.push({
      text,
      options,
      correct,
      topic: TOPICS.includes(raw?.topic) ? raw.topic : "quantitative",
      difficulty: LEVELS.includes(raw?.difficulty) ? raw.difficulty : difficulty === "mixed" ? "medium" : difficulty,
      explanation: cleanText(raw?.explanation, 600, { multiline: true }),
    });
  }
  if (usable.length < Math.min(MIN_USABLE, count)) throw new AiError("The AI did not produce enough usable questions. Try again, or try a narrower topic.");
  const questions = usable.slice(0, count);
  const title = cleanText(data?.title, 40) || cleanText(topic, 40);
  return {
    title,
    description: `Written by AI on "${cleanText(topic, 80)}". Read the answers before you play.`,
    questionTime: 20,
    questions,
  };
}

export function describeStatus(status) {
  if (status === 401 || status === 403) return "The AI key on this server is not valid.";
  if (status === 404) return "The AI model name on this server is not valid.";
  if (status === 429) return "The AI service is busy or its free limit is used up. Try again in a minute.";
  if (status >= 500) return "The AI service had a problem. Try again in a moment.";
  return `The AI service rejected the request (${status}).`;
}

function parseJson(text) {
  const trimmed = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new AiError("The AI answer could not be read. Try again.");
  }
}

async function sendChat(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw new AiError("The AI took too long to answer. Try again with fewer questions.");
    throw new AiError("Could not reach the AI service. Check the server's internet connection.");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new AiError(describeStatus(response.status));
  return response.json();
}

export async function generateQuestions(params, { send = sendChat } = {}) {
  const { system, user } = buildPrompt(params);
  const data = await send({
    model: MODEL,
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const choice = data?.choices?.[0];
  if (!choice) throw new AiError("The AI returned an empty answer. Try again.");
  if (choice.finish_reason === "length") throw new AiError("The AI answer was cut short. Ask for fewer questions.");
  return buildSet(parseJson(choice.message?.content), params);
}

export function describeAiError(err) {
  if (err instanceof AiError) return err.message;
  return "Something went wrong while writing questions. Try again.";
}
