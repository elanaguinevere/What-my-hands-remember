// A tiny finite state machine.
// Only transitions listed in `states[current].on` are allowed; anything else is ignored
// (and logged in debug mode), so a late model callback can never push the story into
// a state that makes no sense.
//
// createMachine({
//   id: 'camera',
//   initial: 'idle',
//   states: {
//     idle:       { on: { REQUEST: 'requesting' } },
//     requesting: { on: { GRANTED: 'on', ERROR: 'error' }, enter(payload) {}, exit() {} },
//     ...
//   }
// }, onChange)

export function createMachine(config, onChange = () => {}) {
  let current = config.initial;
  let data = {};
  const listeners = new Set([onChange]);
  const history = [];

  function send(event, payload = {}) {
    const def = config.states[current];
    let target = def?.on?.[event];
    if (typeof target === 'function') target = target(payload, data);   // guards: return undefined to block
    if (!target) {
      if (createMachine.debug) console.debug(`[${config.id}] ignored ${event} in "${current}"`);
      return false;
    }
    if (!config.states[target]) throw new Error(`[${config.id}] unknown state "${target}"`);
    const from = current;
    def.exit?.(payload, data);
    current = target;
    data = { ...data, ...payload.data };
    history.push({ from, event, to: target, t: Math.round(performance.now()) });
    if (history.length > 50) history.shift();
    config.states[target].enter?.(payload, data);
    listeners.forEach(fn => fn({ id: config.id, from, to: target, event, payload }));
    return true;
  }

  return {
    id: config.id,
    send,
    get state() { return current; },
    get data() { return data; },
    is: (...names) => names.includes(current),
    can: event => !!config.states[current]?.on?.[event],
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    history,
    // The transition table, for the debug panel and the documentation
    table: () => Object.entries(config.states).flatMap(([from, s]) => Object.entries(s.on || {}).map(([ev, to]) => ({ from, event: ev, to: typeof to === 'function' ? '(guard)' : to })))
  };
}
createMachine.debug = new URLSearchParams(location.search).has('debug');
