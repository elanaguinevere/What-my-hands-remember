// 1 · Chop the onion: one chop = one slice, too fast = mom slows you down.
// Sub-states: chopping → too-fast → chopping … → done
import { story } from '../story.js';
import { ChopDetector } from '../gestures/chop.js';

const SLICES = 8;

export default {
  id: 'chop',
  detector: 'hand',
  enter(ctx) {
    const s = story.chop;
    ctx.say(s.mom);
    ctx.hint(ctx.mode === 'camera' ? s.hint : s.mouseHint);

    // Build the onion (slices fall away one by one)
    const g = ctx.$('.onion');
    g.innerHTML = '';
    const slices = [];
    for (let i = 0; i < SLICES; i++) {
      const x = 220 + i * 26, h = 92 - Math.abs(i - 3.5) * 8;
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', `M${x},200 L${x},${200 - h} Q${x + 13},${196 - h} ${x + 26},${204 - h} L${x + 26},200 Z`);
      el.setAttribute('class', 'slice');
      g.appendChild(el);
      slices.push(el);
    }
    slices.reverse();

    let cut = 0, sub = 'chopping';
    const detector = new ChopDetector();
    const chop = () => {
      if (sub !== 'chopping' || cut >= SLICES) return;
      gsap.to(slices[cut], { x: 40 + cut * 4, y: 6, rotation: 18 + Math.random() * 12, transformOrigin: '0% 100%', duration: 0.35, ease: 'back.out(2)' });
      cut += 1;
      ctx.progress(cut / SLICES);
      if (cut === SLICES) { sub = 'done'; ctx.say(s.done); ctx.later(() => ctx.next(), 1800); }
    };
    const tooFast = on => {
      if (sub === 'done') return;
      sub = on ? 'too-fast' : 'chopping';
      ctx.el.classList.toggle('too-fast', on);
      if (on) ctx.say(s.tooFast); else ctx.say(s.mom);
    };

    // Camera
    ctx.on('hand', hand => {
      const ev = detector.update(hand);
      if (ev === 'chop') chop();
      if (ev === 'too-fast') tooFast(true);
      if (sub === 'too-fast' && !detector.tooFast) tooFast(false);
    });
    // Mouse: click = chop; more than 3.5 clicks per second = too fast
    let clicks = [];
    ctx.listen(ctx.$('.scene'), 'click', () => {
      if (ctx.mode !== 'mouse') return;
      const now = performance.now();
      clicks = [...clicks.filter(t => now - t < 1000), now];
      if (clicks.length > 3.5) { tooFast(true); ctx.later(() => tooFast(false), 1200); return; }
      chop();
    });
  },
  exit(ctx) { ctx.el.classList.remove('too-fast'); gsap.set(ctx.el.querySelectorAll('.slice'), { clearProps: 'all' }); }
};
