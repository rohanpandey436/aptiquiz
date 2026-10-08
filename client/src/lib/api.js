import { hostKey } from "./storage.js";

async function call(method, path, body) {
  const headers = { Accept: "application/json" };
  const key = hostKey.get();
  if (key) headers["x-host-key"] = key;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401) hostKey.clear();
    const message = data?.error || (Array.isArray(data?.errors) ? data.errors.join(". ") : `Request failed (${res.status})`);
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => call("GET", path),
  post: (path, body) => call("POST", path, body ?? {}),
  del: (path) => call("DELETE", path),
};
