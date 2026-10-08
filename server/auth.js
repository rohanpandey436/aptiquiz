import crypto from "node:crypto";

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

const configured = process.env.HOST_PASSCODE?.trim() || "";
const passcodeDigest = configured ? crypto.createHash("sha256").update(configured).digest() : null;
const failures = new Map();

if (!configured) {
  console.log("Editor is open to everyone (HOST_PASSCODE not set). Set it to lock the question editor.");
}

function digest(value) {
  return crypto.createHash("sha256").update(String(value ?? "")).digest();
}

export function editorLocked() {
  return !!passcodeDigest;
}

export function keyMatches(provided) {
  if (!passcodeDigest) return true;
  return typeof provided === "string" && provided.length > 0 && crypto.timingSafeEqual(digest(provided), passcodeDigest);
}

export function isBlocked(ip) {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(ip) {
  const now = Date.now();
  const entry = failures.get(ip);
  if (!entry || now > entry.resetAt) {
    failures.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function verifyHostKey(provided, ip) {
  if (!passcodeDigest) return { ok: true };
  if (isBlocked(ip)) return { ok: false, blocked: true };
  if (keyMatches(provided)) {
    failures.delete(ip);
    return { ok: true };
  }
  recordFailure(ip);
  return { ok: false, blocked: isBlocked(ip) };
}

export function clientIp(req) {
  if (req.ip) return req.ip;
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return req.socket?.remoteAddress || "unknown";
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of failures) if (now > entry.resetAt) failures.delete(ip);
}, FAILURE_WINDOW_MS).unref();
