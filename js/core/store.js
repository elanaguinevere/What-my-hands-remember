// Small reactive store for values that are not "states" (fps, backend, warnings, counters).
export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      listeners.forEach(fn => fn(state, prev));
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
