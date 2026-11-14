// Boot + step runner.
// The flow machine decides WHICH step is active; this file makes it so:
// exit the old step (and clean up everything it registered), switch the visible scene,
// tell the models which detector to run, enter the new step.
import { machines, values, STEPS } from './state.js';
import { bus } from './core/bus.js';
import { staticChecks } from './core/system-check.js';
import { useDetector } from './input/models.js';
import { startCamera } from './input/camera.js';
import { story } from './story.js';
import { initStatusLight, initProgress, initDebug, initBodyState, toast, notice } from './ui.js';

import intro from './steps/intro.js';
import setup from './steps/setup.js';
import teach from './steps/teach.js';
import chop from './steps/chop.js';
import grind from './steps/grind.js';
import spices from './steps/spices.js';
import stir from './steps/stir.js';
import taste from './steps/taste.js';
import alone from './steps/alone.js';
import finale from './steps/finale.js';

const registry = { intro, setup, teach, chop, grind, spices, stir, taste, alone, finale };
console.assert(STEPS.every(s => registry[s]), 'every step in STEPS needs a module');

// ---------- Step context: everything a step may use, all cleaned up on exit ----------
function makeContext(step) {
  const el = document.querySelector(`.step[data-step="${step.id}"]`);
  const cleanups = [];
  const ctx = {
    el, story: story[step.id], values,
    $: sel => el.querySelector(sel),
    $$: sel => [...el.querySelectorAll(sel)],
    get mode() { return machines.input.is('camera') && machines.camera.is('on') ? 'camera' : 'mouse'; },
    get reducedMotion() { return values.get().reducedMotion; },
    next: () => machines.flow.send('NEXT'),
    useMouse: () => machines.input.send('MOUSE'),
    say: text => { const s = el.querySelector('.say'); if (s) { s.textContent = text; gsap.fromTo(s, { opacity: 0 }, { opacity: 1, duration: 0.5 }); } },
    hint: text => { const h = el.querySelector('.hint'); if (h && h.textContent !== text) h.textContent = text; },
    progress: p => { const bar = el.querySelector('.step-progress > i'); if (bar) bar.style.width = `${Math.round(p * 100)}%`; },
    on: (event, fn) => cleanups.push(bus.on(event, fn)),
    listen: (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); },
    later: (fn, ms) => { const id = setTimeout(fn, ms); cleanups.push(() => clearTimeout(id)); },
    every: (fn, ms) => { const id = setInterval(fn, ms); cleanups.push(() => clearInterval(id)); },
    wait: ms => new Promise(r => ctx.later(r, ms)),
    cleanup: fn => cleanups.push(fn),
    _dispose: () => { while (cleanups.length) { try { cleanups.pop()(); } catch (e) { console.error(e); } } }
  };
  return ctx;
}

// ---------- Step runner ----------
let current = null, ctx = null;
function runStep(id) {
  const step = registry[id];
  const prevEl = ctx?.el;
  if (current) { try { current.exit?.(ctx); } catch (e) { console.error(e); } ctx._dispose(); }

  current = step;
  ctx = makeContext(step);
  document.querySelectorAll('.step').forEach(s => s.classList.toggle('active', s === ctx.el));
  document.body.classList.toggle('scrolling', !!step.scroll);
  if (prevEl && prevEl !== ctx.el) gsap.fromTo(ctx.el, { opacity: 0 }, { opacity: 1, duration: values.get().reducedMotion ? 0.2 : 0.8 });
  useDetector(step.detector, { shapes: !!step.shapes });
  try { step.enter(ctx); }
  catch (e) { console.error(`step ${id} failed to start`, e); toast('Something went wrong in this step. You can skip it with the button below.', { force: true }); }
}
machines.flow.subscribe(({ to }) => runStep(to));

// If the input changes mid-step (camera lost → mouse), update the hint and the detector
machines.input.subscribe(() => {
  if (!current) return;
  const s = story[current.id];
  if (s?.hint) ctx.hint(ctx.mode === 'camera' ? s.hint : (s.mouseHint || s.hint));
  useDetector(current.detector, { shapes: !!current.shapes });
});

// ---------- Session: pause when the tab is hidden, block when the camera is lost ----------
document.addEventListener('visibilitychange', () => machines.session.send(document.hidden ? 'HIDE' : 'SHOW'));

machines.camera.subscribe(async ({ to }) => {
  if (to !== 'lost' || !machines.input.is('camera')) return;
  machines.session.send('BLOCK');
  const choice = await notice({ title: story.errors.lost, text: 'Is it still plugged in, or is another app using it?', actions: { retry: story.errors.retry, mouse: story.errors.mouse } });
  if (choice === 'retry') {
    try { await startCamera(); }
    catch { machines.input.send('FALLBACK'); toast('Still no camera. You\'re cooking with your mouse now.', { force: true }); }
  } else machines.input.send('MOUSE');
  machines.session.send('RESOLVE');
});

// ---------- Global errors: log, and tell the visitor once in a while (rate-limited toast) ----------
addEventListener('error', e => { console.error(e.error || e.message); toast('Something hiccupped, but you can keep cooking.'); });
addEventListener('unhandledrejection', e => { console.error(e.reason); toast('Something hiccupped, but you can keep cooking.'); });

// ---------- Boot ----------
async function boot() {
  const libs = { gsap: !!window.gsap, ScrollTrigger: !!window.ScrollTrigger, SplitText: !!window.SplitText, DrawSVG: !!window.DrawSVGPlugin, MotionPath: !!window.MotionPathPlugin };
  if (!libs.gsap) { document.body.classList.add('static'); return; }   // CSS shows the static text version
  gsap.registerPlugin(...[window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin, window.MotionPathPlugin, window.MorphSVGPlugin, window.ScrollToPlugin].filter(Boolean));

  const checks = await staticChecks({ libs });
  const gpu = checks.find(c => c.id === 'gpu');
  values.set({
    warnings: checks.filter(c => c.status !== 'ok'),
    gpu: gpu?.status === 'ok' ? 'webgpu' : gpu?.status === 'warn' ? 'webgl' : 'none',
    smallScreen: checks.some(c => c.id === 'screen' && c.status !== 'ok')
  });

  initBodyState(); initStatusLight(); initProgress(); initDebug();
  // Escape hatch on every interactive step (when a gesture just won't work for someone)
  document.getElementById('skip').addEventListener('click', () => machines.flow.send('NEXT'));

  if (values.get().smallScreen) {
    await notice({ title: 'Best on a laptop or desktop', text: 'This kitchen is made for a bigger screen and a webcam.', actions: { go: 'Continue anyway' } });
  }
  runStep(machines.flow.state);
}
boot();
