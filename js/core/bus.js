// Event bus between the inputs (camera models, mouse) and the steps.
// Inputs emit: 'hand' (hand | null), 'face' (face | null), 'shape' ({ open, fist, pinch }),
//              'pointer' ({ x, y, down, inside }), 'key' ({ key, down })
// Steps listen only while they are active (ctx.on returns an "off" function that the step runner calls on exit).
const handlers = new Map();

export const bus = {
  on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => handlers.get(event)?.delete(fn);
  },
  emit(event, payload) {
    handlers.get(event)?.forEach(fn => {
      try { fn(payload); } catch (err) { console.error(`[bus] ${event} handler failed`, err); }
    });
  },
  count: event => handlers.get(event)?.size || 0
};
