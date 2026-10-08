export const LETTERS = ["A", "B", "C", "D", "E", "F"];

export const OPTION_COLORS = ["bg-opt-a", "bg-opt-b", "bg-opt-c", "bg-opt-d", "bg-opt-e", "bg-opt-f"];

export const TOPIC_LABELS = {
  quantitative: "Quantitative",
  logical: "Logical reasoning",
  verbal: "Verbal ability",
  "data interpretation": "Data interpretation",
};

export function topicLabel(topic) {
  return TOPIC_LABELS[topic] || topic;
}

export function seconds(ms) {
  if (ms === null || ms === undefined) return "-";
  return `${(ms / 1000).toFixed(1)} s`;
}

export function signed(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function joinUrl(code) {
  return `${window.location.origin}/play/${code}`;
}

export function downloadCsv(filename, rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const levelLabel = (level) => (level ? level[0].toUpperCase() + level.slice(1) : "");
