/**
 * Tiny persisted store backing the mock services. State lives in localStorage so it survives reloads and is shared
 * between tabs; it is re-read on every access so two tabs never overwrite each other with stale data.
 */
export function createMockStore<T extends object>(key: string, seed: () => T) {
  const read = (): T => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* fall through to a fresh seed */
    }
    const fresh = seed();
    write(fresh);
    return fresh;
  };

  const write = (state: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* storage unavailable: the state simply lives for this call */
    }
  };

  return {
    get: read,
    /** Applies `recipe` to the current state and persists it; returns whatever the recipe returns. */
    update<R>(recipe: (state: T) => R): R {
      const state = read();
      const result = recipe(state);
      write(state);
      return result;
    },
    reset: () => write(seed()),
  };
}

export function newId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}
