// All state of the application lives here.
//
// Seven machines run side by side (they don't block each other):
//   flow       which recipe step the visitor is in (the story)
//   input      camera or mouse
//   camera     the webcam's own life cycle, incl. every error type
//   handPose / faceMesh   model loading
//   classifier the self-trained network (open / fist / pinch)
//   session    running / paused (tab hidden) / blocked (camera lost, waiting for the visitor)
//
// Plus one store for live values (fps, backend, warnings…).
// Every change is broadcast to `onAnyChange`, which the debug panel (press D) and the body classes use.

import { createMachine } from './core/machine.js';
import { createStore } from './core/store.js';

export const STEPS = ['intro', 'setup', 'teach', 'chop', 'grind', 'spices', 'stir', 'taste', 'alone', 'finale'];

const changeListeners = new Set();
export const onAnyChange = fn => { changeListeners.add(fn); return () => changeListeners.delete(fn); };
const broadcast = change => changeListeners.forEach(fn => fn(change));

export const values = createStore({
  gpu: '',                // from the system check: webgpu | webgl | none
  backend: '',            // TF.js backend ml5 ended up with: webgpu | webgl | cpu
  fps: 0,
  light: null,            // { avg, status, detail }
  framing: null,          // hand framing check
  warnings: [],           // results of system-check with status warn/fail
  smallScreen: false,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  samples: { open: 0, fist: 0, pinch: 0 },
  spicesAdded: 0,
  lastError: null
});
values.subscribe((s, prev) => broadcast({ id: 'values', s, prev }));

// ---------- flow: the story ----------
// NEXT goes one step further. GOTO (debug + progress dots) jumps anywhere.
// From setup: in mouse mode we skip "teach" — there are no hands to teach.
const flowStates = {};
STEPS.forEach((step, i) => {
  flowStates[step] = {
    on: {
      NEXT: STEPS[i + 1],
      GOTO: ({ to }) => STEPS.includes(to) ? to : undefined,
      RESTART: 'intro'
    }
  };
});
flowStates.setup.on.NEXT = () => (machines.input.is('mouse') ? 'chop' : 'teach');
delete flowStates.finale.on.NEXT;

// ---------- the other machines ----------
const modelMachine = id => createMachine({
  id, initial: 'idle',
  states: {
    idle:    { on: { LOAD: 'loading' } },
    loading: { on: { LOADED: 'ready', FAILED: 'error' } },
    ready:   { on: { UNLOAD: 'idle' } },
    error:   { on: { LOAD: 'loading' } }
  }
}, broadcast);

export const machines = {
  flow: createMachine({ id: 'flow', initial: 'intro', states: flowStates }, broadcast),

  input: createMachine({
    id: 'input', initial: 'none',
    states: {
      none:   { on: { CAMERA: 'camera', MOUSE: 'mouse' } },
      camera: { on: { MOUSE: 'mouse', FALLBACK: 'mouse' } },
      mouse:  { on: { CAMERA: 'camera' } }
    }
  }, broadcast),

  camera: createMachine({
    id: 'camera', initial: 'idle',
    states: {
      idle:       { on: { REQUEST: 'requesting' } },
      requesting: { on: { GRANTED: 'on', DENIED: 'denied', NOT_FOUND: 'missing', BUSY: 'busy', INSECURE: 'insecure', ERROR: 'error' } },
      on:         { on: { LOST: 'lost', STOP: 'idle' } },
      lost:       { on: { RETRY: 'requesting', STOP: 'idle' } },
      denied:     { on: { RETRY: 'requesting', STOP: 'idle' } },
      missing:    { on: { RETRY: 'requesting', STOP: 'idle' } },
      busy:       { on: { RETRY: 'requesting', STOP: 'idle' } },
      insecure:   { on: { STOP: 'idle' } },              // retrying won't help on http
      error:      { on: { RETRY: 'requesting', STOP: 'idle' } }
    }
  }, broadcast),

  handPose: modelMachine('handPose'),
  faceMesh: modelMachine('faceMesh'),

  classifier: createMachine({
    id: 'classifier', initial: 'untrained',
    states: {
      untrained:  { on: { COLLECT: 'collecting' } },
      collecting: { on: { RECORD: 'recording', TRAIN: (_, d) => enoughSamples() ? 'training' : undefined } },
      recording:  { on: { RECORDED: 'collecting' } },
      training:   { on: { TRAINED: 'ready', FAILED: 'collecting' } },
      ready:      { on: { RETRAIN: 'collecting' } }
    }
  }, broadcast),

  session: createMachine({
    id: 'session', initial: 'running',
    states: {
      running: { on: { HIDE: 'paused', BLOCK: 'blocked' } },
      paused:  { on: { SHOW: 'running', BLOCK: 'blocked' } },
      blocked: { on: { RESOLVE: 'running' } }       // camera lost: wait for Retry or "continue with mouse"
    }
  }, broadcast)
};

export const MIN_SAMPLES = 15;
export function enoughSamples() {
  const s = values.get().samples;
  return s.open >= MIN_SAMPLES && s.fist >= MIN_SAMPLES && s.pinch >= MIN_SAMPLES;
}

// Snapshot of everything, for the debug panel
export function snapshot() {
  const out = {};
  for (const [k, m] of Object.entries(machines)) out[k] = m.state;
  const { warnings, light, framing, ...rest } = values.get();
  return { ...out, ...rest, light: light?.detail, framing: framing?.detail, warnings: warnings.map(w => `${w.status}: ${w.label}`) };
}
