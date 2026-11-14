// ml5 models: lazy loading, one detector at a time, pause when hidden.
//   loadHandPose()  → machines.handPose
//   loadFaceMesh()  → machines.faceMesh
//   useDetector('hand' | 'face' | null)   — the active step decides which model runs
// Results go out on the bus: 'hand', 'face', and (when wanted) 'shape' from the classifier.
import { machines, values } from '../state.js';
import { bus } from '../core/bus.js';
import { loadScript, withTimeout, backendCheck, measureLight, checkHandFraming } from '../core/system-check.js';
import { video } from './camera.js';
import { classifier } from '../ml/classifier.js';

const ML5_SRC = 'js/lib/ml5.min.js';
const LOAD_TIMEOUT = 45000;
const models = { hand: null, face: null };
let active = null;          // which detector is running
let wanted = null;          // which detector the step asked for
let wantShapes = false;

async function ensureMl5() {
  if (window.ml5) return;
  await loadScript(ML5_SRC, LOAD_TIMEOUT);
}

async function load(kind) {
  const machine = kind === 'hand' ? machines.handPose : machines.faceMesh;
  if (machine.is('ready', 'loading')) return waitFor(machine);
  machine.send('LOAD');
  try {
    await ensureMl5();
    // ml5 1.4 without p5: the factory returns a promise → await it (see LOG / project notes)
    models[kind] = await withTimeout(kind === 'hand'
      ? ml5.handPose({ maxHands: 1, flipped: true, modelType: values.get().gpu === 'webgpu' ? 'full' : 'lite' })   // E1: lite keeps WebGL above 20 fps
      : ml5.faceMesh({ maxFaces: 1, refineLandmarks: false, flipped: true }), LOAD_TIMEOUT, kind === 'hand' ? 'HandPose' : 'FaceMesh');
    const b = backendCheck();
    values.set({ backend: b.detail });
    machine.send('LOADED');
    if (wanted === kind) start(kind);
  } catch (err) {
    values.set({ lastError: { name: err.name, message: err.message } });
    machine.send('FAILED', { error: err });
    throw err;
  }
}
function waitFor(machine) {
  return new Promise((resolve, reject) => {
    if (machine.is('ready')) return resolve();
    const off = machine.subscribe(c => { if (c.to === 'ready') { off(); resolve(); } if (c.to === 'error') { off(); reject(new Error('model failed')); } });
  });
}
export const loadHandPose = () => load('hand');
export const loadFaceMesh = () => load('face');

// ---------- Detection ----------
const resultTimes = [];
let lastShapeAt = 0;
function onResults(kind, results) {
  const now = performance.now();
  resultTimes.push(now);
  while (now - resultTimes[0] > 2000) resultTimes.shift();
  const item = results[0] || null;
  bus.emit(kind, item);
  if (kind === 'hand') {
    if (wantShapes && item && now - lastShapeAt > 70) {           // classify every 70 ms (E5)
      lastShapeAt = now;
      classifier.classify(item.keypoints).then(conf => conf && bus.emit('shape', conf));
    }
    if (item && classifier.recordingLabel) classifier.addSample(classifier.recordingLabel, item.keypoints);
    frameForChecks = item;
  }
}
let frameForChecks = null;

function start(kind) {
  if (active === kind || !models[kind] || !machines.camera.is('on')) return;
  stop();
  models[kind].detectStart(video, r => onResults(kind, r));
  active = kind;
}
function stop() {
  if (active && models[active]) models[active].detectStop();
  active = null;
}

// The step runner calls this on every step change
export function useDetector(kind, { shapes = false } = {}) {
  wanted = kind; wantShapes = shapes;
  if (!kind || !machines.input.is('camera')) return stop();
  if (machines.session.is('running')) start(kind);
}

// Pause / resume with the session (tab hidden, camera lost)
machines.session.subscribe(({ to }) => {
  if (to === 'running') useDetector(wanted, { shapes: wantShapes });
  else stop();
});
machines.camera.subscribe(({ to }) => { if (to !== 'on') stop(); });

// Live checks 2× per second: fps, light, hand framing
setInterval(() => {
  if (!active) return;
  const n = resultTimes.length;
  const fps = n > 1 ? (n - 1) / ((resultTimes[n - 1] - resultTimes[0]) / 1000) : 0;
  const patch = { fps: Math.round(fps * 10) / 10, light: measureLight(video) };
  if (active === 'hand') patch.framing = checkHandFraming(frameForChecks, video.videoWidth, video.videoHeight);
  values.set(patch);
}, 500);
