function safe(storage) {
  return {
    get(key, fallback = null) {
      try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch {
        return;
      }
    },
    remove(key) {
      try {
        storage.removeItem(key);
      } catch {
        return;
      }
    },
  };
}

const local = safe(typeof window !== "undefined" ? window.localStorage : null);
const session = safe(typeof window !== "undefined" ? window.sessionStorage : null);

export const playerSeat = {
  get: (code) => local.get(`aq:player:${code}`),
  set: (code, seat) => local.set(`aq:player:${code}`, seat),
  clear: (code) => local.remove(`aq:player:${code}`),
};

export const hostSeat = {
  get: (code) => local.get(`aq:host:${code}`),
  set: (code, seat) => local.set(`aq:host:${code}`, seat),
};

export const hostKey = {
  get: () => session.get("aq:hostKey", ""),
  set: (key) => session.set("aq:hostKey", key),
  clear: () => session.remove("aq:hostKey"),
};
