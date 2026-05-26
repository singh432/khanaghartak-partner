// Polyfill localStorage/sessionStorage for the server runtime so modules
// that touch them at top level (e.g. the auto-generated Supabase client)
// don't crash during SSR. The real browser localStorage is used in the
// client bundle as normal.
if (typeof globalThis.localStorage === "undefined") {
  const memory = new Map<string, string>();
  const stub: Storage = {
    get length() { return memory.size; },
    clear: () => memory.clear(),
    getItem: (k) => memory.get(k) ?? null,
    key: (i) => Array.from(memory.keys())[i] ?? null,
    removeItem: (k) => { memory.delete(k); },
    setItem: (k, v) => { memory.set(k, String(v)); },
  };
  (globalThis as any).localStorage = stub;
  (globalThis as any).sessionStorage = stub;
}

export {};
