const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const CONTROL_RE = /[\u0000-\u001F\u007F]/g;

export function cleanName(value) {
  if (typeof value !== "string") return "";
  const name = value.replace(CONTROL_RE, "").replace(/\s+/g, " ").trim().slice(0, 20);
  return name.length >= 1 ? name : "";
}

export function cleanCode(value) {
  const code = String(value || "").toUpperCase().replace(/\s+/g, "");
  return CODE_RE.test(code) ? code : "";
}

export function cleanCollege(value) {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_RE, "").replace(/\s+/g, " ").trim().slice(0, 60);
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
