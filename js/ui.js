// UI that is not part of a step: status light, progress dots, toast, notice dialog, debug panel.
import { machines, values, STEPS, snapshot, onAnyChange } from './state.js';
import { story } from './story.js';

const $ = sel => document.querySelector(sel);

// ---------- Status light: grey idle · yellow loading · green on · red error ----------
export function initStatusLight() {
  const light = $('#status-light'), label = $('#status-label');
  const update = () => {
    const cam = machines.camera.state, hp = machines.handPose.state, fm = machines.faceMesh.state;
    let colour = 'grey', text = 'mouse mode';
    if (machines.input.is('camera')) {
      if (['denied', 'missing', 'busy', 'insecure', 'error', 'lost'].includes(cam) || hp === 'error' || fm === 'error') { colour = 'red'; text = cam === 'lost' ? 'camera lost' : 'camera problem'; }
      else if (cam === 'requesting' || hp === 'loading' || fm === 'loading') { colour = 'yellow'; text = 'loading…'; }
      else if (cam === 'on') { colour = 'green'; text = `camera · ${values.get().fps || '–'} fps`; }
    } else if (machines.input.is('none')) text = '';
    if (machines.session.is('paused')) { colour = 'grey'; text = 'paused'; }
    light.dataset.colour = colour;
    label.textContent = text;
  };
  onAnyChange(update);
  update();
}

// ---------- Progress dots (also a way to jump, like the old version) ----------
export function initProgress() {
  const nav = $('#progress');
  const visible = STEPS.filter(s => !['intro', 'setup', 'teach'].includes(s));
  nav.innerHTML = visible.map(s => `<button data-to="${s}" aria-label="${s}" title="${s}"></button>`).join('');
  nav.addEventListener('click', e => {
    const to = e.target.dataset.to;
    // Only allow going back to steps already done (forward jumps are for the debug panel)
    if (to && visible.indexOf(to) < visible.indexOf(machines.flow.state)) machines.flow.send('GOTO', { to });
  });
  machines.flow.subscribe(({ to }) => {
    const i = visible.indexOf(to);
    nav.hidden = i < 0;
    [...nav.children].forEach((b, j) => { b.classList.toggle('done', j < i); b.classList.toggle('current', j === i); });
  });
}

// ---------- Toast (rate-limited, so an error loop can't spam the visitor) ----------
let lastToast = 0, toastTimer = null;
export function toast(text, { force = false, ms = 3500 } = {}) {
  const now = performance.now();
  if (!force && now - lastToast < 4000) return;
  lastToast = now;
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- Notice: blocks the story until the visitor chooses (camera lost etc.) ----------
export function notice({ title, text, actions }) {
  const el = $('#notice');
  el.querySelector('h2').textContent = title;
  el.querySelector('p').textContent = text || '';
  const box = el.querySelector('.actions');
  box.innerHTML = '';
  return new Promise(resolve => {
    for (const [key, label] of Object.entries(actions)) {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = key === Object.keys(actions)[0] ? '' : 'secondary';
      b.addEventListener('click', () => { el.hidden = true; resolve(key); });
      box.appendChild(b);
    }
    el.hidden = false;
    box.querySelector('button')?.focus();
  });
}

// ---------- Debug panel: press D (or open with ?debug) ----------
export function initDebug() {
  const panel = $('#debug');
  const render = () => {
    if (panel.hidden) return;
    const snap = snapshot();
    const flowTable = machines.flow.history.slice(-6).map(h => `${h.from} —${h.event}→ ${h.to}`).join('\n');
    panel.querySelector('pre').textContent = JSON.stringify(snap, null, 1) + '\n\nlast transitions:\n' + flowTable;
  };
  panel.querySelector('.jump').innerHTML = STEPS.map(s => `<button data-to="${s}">${s}</button>`).join('');
  panel.querySelector('.jump').addEventListener('click', e => e.target.dataset.to && machines.flow.send('GOTO', { to: e.target.dataset.to }));
  panel.querySelector('[data-act="mouse"]').addEventListener('click', () => machines.input.send('MOUSE'));
  panel.querySelector('[data-act="lose"]').addEventListener('click', () => machines.camera.is('on') && machines.camera.send('LOST', { reason: 'simulated' }));
  addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'd' && !e.target.closest('input, textarea')) { panel.hidden = !panel.hidden; render(); }
  });
  if (new URLSearchParams(location.search).has('debug')) panel.hidden = false;
  onAnyChange(render);
  setInterval(render, 500);
  render();
}

// Body attributes mirror the machines, so CSS can react (e.g. [data-input="mouse"] shows mouse hints)
export function initBodyState() {
  const sync = () => {
    for (const [k, m] of Object.entries(machines)) document.body.dataset[k] = m.state;
  };
  onAnyChange(sync);
  sync();
}

export { story };
