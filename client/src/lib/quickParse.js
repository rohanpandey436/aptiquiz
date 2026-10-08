const LETTERS = "ABCDEF";
const OPTION_RE = /^\s*(\*?)\s*([A-Fa-f])\s*[).:\-]\s*(.+)$/;
const DASH_RE = /^\s*(\*?)\s*[-•]\s*(.+)$/;
const ANSWER_RE = /^\s*(answer|ans|correct)\s*[:=]\s*([A-Fa-f])\b/i;
const TOPIC_RE = /^\s*topic\s*[:=]\s*(.+)$/i;
const WHY_RE = /^\s*(why|explain|explanation)\s*[:=]\s*(.+)$/i;
const TOPICS = { quant: "quantitative", quantitative: "quantitative", maths: "quantitative", math: "quantitative", logical: "logical", logic: "logical", reasoning: "logical", verbal: "verbal", english: "verbal", di: "data interpretation", data: "data interpretation", "data interpretation": "data interpretation" };

export const QUICK_EXAMPLE = `What is 15% of 200?
A) 30
B) 25
C) 35
D) 40
Answer: A
Topic: quant

Find the next number: 2, 6, 12, 20, ?
A) 28
B) 30
C) 32
D) 36
Answer: B
Why: Differences grow by 2 each time.`;

function normaliseTopic(raw) {
  const key = raw.trim().toLowerCase();
  return TOPICS[key] || Object.entries(TOPICS).find(([k]) => key.startsWith(k))?.[1] || "quantitative";
}

export function parseQuickQuestions(text) {
  const blocks = String(text || "")
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const questions = [];
  const errors = [];
  blocks.forEach((block, index) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const q = { text: "", options: [], correct: -1, topic: "quantitative", difficulty: "medium", explanation: "" };
    const textLines = [];
    for (const line of lines) {
      let m;
      if ((m = line.match(ANSWER_RE))) {
        q.correct = LETTERS.indexOf(m[2].toUpperCase());
      } else if ((m = line.match(TOPIC_RE))) {
        q.topic = normaliseTopic(m[1]);
      } else if ((m = line.match(WHY_RE))) {
        q.explanation = m[2].trim();
      } else if ((m = line.match(OPTION_RE))) {
        q.options.push(m[3].trim());
        if (m[1]) q.correct = q.options.length - 1;
      } else if (q.options.length && (m = line.match(DASH_RE))) {
        q.options.push(m[2].trim());
        if (m[1]) q.correct = q.options.length - 1;
      } else if (!q.options.length) {
        textLines.push(line);
      } else {
        errors.push(`Question ${index + 1}: could not read the line "${line.slice(0, 40)}"`);
      }
    }
    q.text = textLines.join(" ").replace(/^\d+[).]\s*/, "").trim();
    if (!q.text) errors.push(`Question ${index + 1}: the first line should be the question`);
    if (q.options.length < 2) errors.push(`Question ${index + 1}: write at least two options like "A) 30"`);
    if (q.correct < 0 || q.correct >= q.options.length) errors.push(`Question ${index + 1}: mark the answer with "Answer: B" or a * before the right option`);
    questions.push(q);
  });
  return { questions, errors, count: questions.length };
}
