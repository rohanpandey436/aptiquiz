const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const CONTROL_RE = /[\u0000-\u001F\u007F]/g;
const CONTROL_KEEP_WHITESPACE_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const TOPICS = ["quantitative", "logical", "verbal", "data interpretation"];
export const DIFFICULTIES = ["easy", "medium", "hard"];

export function cleanText(value, max, { multiline = false } = {}) {
  if (typeof value !== "string") return "";
  const stripped = value.replace(multiline ? CONTROL_KEEP_WHITESPACE_RE : CONTROL_RE, "");
  const collapsed = multiline ? stripped : stripped.replace(/\s+/g, " ");
  return collapsed.trim().slice(0, max);
}

export function cleanName(value) {
  return cleanText(value, 20);
}

export function cleanCode(value) {
  const code = String(value || "").toUpperCase().replace(/\s+/g, "");
  return CODE_RE.test(code) ? code : "";
}

export function cleanCollege(value) {
  return cleanText(value, 60);
}

export function cleanToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(value) ? value : "";
}

export function cleanInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

export function cleanId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : "";
}

export function validateQuestion(raw, index, newId) {
  const errors = [];
  const q = {};
  q.id = cleanId(raw?.id) || newId("q_");
  q.text = cleanText(raw?.text, 600, { multiline: true });
  if (!q.text) errors.push(`Question ${index + 1}: text is required`);
  const options = Array.isArray(raw?.options) ? raw.options.map((o) => cleanText(o, 200)) : [];
  if (options.length < 2 || options.length > 6) errors.push(`Question ${index + 1}: needs 2 to 6 options`);
  if (options.some((o) => !o)) errors.push(`Question ${index + 1}: every option needs text`);
  q.options = options;
  q.correct = Number(raw?.correct);
  if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= options.length) {
    errors.push(`Question ${index + 1}: correct answer must point to one of the options`);
  }
  q.topic = TOPICS.includes(raw?.topic) ? raw.topic : "quantitative";
  q.difficulty = DIFFICULTIES.includes(raw?.difficulty) ? raw.difficulty : "medium";
  const image = cleanText(raw?.image, 500);
  q.image = /^https?:\/\//i.test(image) ? image : null;
  if (Array.isArray(raw?.table) && raw.table.length) {
    const rows = raw.table.slice(0, 10).map((r) => (Array.isArray(r) ? r.slice(0, 8).map((c) => cleanText(String(c ?? ""), 60)) : []));
    q.table = rows.filter((r) => r.length);
    if (!q.table.length) q.table = null;
  } else {
    q.table = null;
  }
  q.explanation = cleanText(raw?.explanation, 600, { multiline: true });
  q.time = cleanInt(raw?.time, 5, 120, null);
  return { q, errors };
}

export function validateSet(raw, newId) {
  const errors = [];
  const title = cleanText(raw?.title, 80);
  if (!title) errors.push("Title is required");
  const questions = Array.isArray(raw?.questions) ? raw.questions : [];
  if (!questions.length) errors.push("Add at least one question");
  if (questions.length > 200) errors.push("A set can hold up to 200 questions");
  const cleaned = [];
  questions.slice(0, 200).forEach((rq, i) => {
    const { q, errors: qe } = validateQuestion(rq, i, newId);
    errors.push(...qe);
    cleaned.push(q);
  });
  return {
    errors,
    set: {
      id: cleanId(raw?.id),
      title,
      description: cleanText(raw?.description, 200),
      questionTime: cleanInt(raw?.questionTime, 5, 120, 20),
      questions: cleaned,
    },
  };
}

export function createRateLimiter(perSecond) {
  const buckets = new Map();
  return {
    allow(key) {
      const now = Date.now();
      const bucket = buckets.get(key) || { tokens: perSecond, updated: now };
      const refill = ((now - bucket.updated) / 1000) * perSecond;
      bucket.tokens = Math.min(perSecond, bucket.tokens + refill);
      bucket.updated = now;
      if (bucket.tokens < 1) {
        buckets.set(key, bucket);
        return false;
      }
      bucket.tokens -= 1;
      buckets.set(key, bucket);
      return true;
    },
    forget(key) {
      buckets.delete(key);
    },
  };
}
