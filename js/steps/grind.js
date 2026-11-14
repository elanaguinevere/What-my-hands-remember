// 2 · Grind the spices: circles with a fist → seeds crack into powder, colour shifts.
import { story } from '../story.js';
import { CircleTracker } from '../gestures/circle.js';
import { openness } from '../gestures/hand.js';

const GOAL = 6, SEEDS = 14;

export default {
  id: 'grind',
  detector: 'hand',
  enter(ctx) {
    const s = story.grind;
    ctx.say(s.mom);
    ctx.hint(ctx.mode === 'camera' ? s.hint : s.mouseHint);

    const g = ctx.$('.seeds');
    g.innerHTML = '';
    const seeds = [];
    for (let i = 0; i < SEEDS; i++) {
      const a = (i / SEEDS) * Math.PI * 2, e = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      e.setAttribute('cx', 320 + Math.cos(a) * (40 + (i % 3) * 30)); e.setAttribute('cy', 175 + Math.sin(a) * (10 + (i % 3) * 6));
      e.setAttribute('rx', 9); e.setAttribute('ry', 6); e.setAttribute('class', 'seed');
      g.appendChild(e); seeds.push(e);
    }
    const colour = gsap.utils.interpolate('#6b3f1f', '#d9a03a');
    const tracker = new CircleTracker();
    let done = false;

    // Mapping (accumulate): turns → each seed cracks at its own moment
    const render = () => {
      const p = Math.min(1, tracker.turns / GOAL);
      ctx.progress(p);
      seeds.forEach((el, i) => {
        const t = Math.min(1, Math.max(0, p * SEEDS - i * 0.6));
        el.setAttribute('rx', 9 + 7 * t); el.setAttribute('ry', 6 - 3 * t); el.setAttribute('fill', colour(t));
      });
      if (p >= 1 && !done) { done = true; ctx.say(s.done); ctx.later(() => ctx.next(), 1800); }
    };

    ctx.on('hand', hand => {
      const fist = hand && openness(hand.keypoints) < 1.25;
      tracker.updateHand(hand, performance.now(), fist);
      if (hand && !fist) ctx.hint(s.wrongShape); else ctx.hint(s.hint);
      render();
    });
    ctx.listen(ctx.$('.scene'), 'mousemove', e => {
      if (ctx.mode !== 'mouse') return;
      const r = ctx.$('.scene').getBoundingClientRect();   // not e.offsetX (unreliable on SVG children)
      tracker.add((e.clientX - r.left) / 40, (e.clientY - r.top) / 40);
      render();
    });
  }
};
