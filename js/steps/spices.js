// 3 · Add spices: mom shows a number of pinches, you copy, one pinch = one spice.
// Uses 'shape' results from the self-trained classifier (or the distance rule as fallback).
import { story } from '../story.js';
import { values } from '../state.js';
import { PinchCounter } from '../gestures/pinch.js';

const TARGET = 3;

export default {
  id: 'spices',
  detector: 'hand',
  shapes: true,                       // ask models.js to classify hand shapes
  enter(ctx) {
    const s = story.spices;
    ctx.say(s.mom);
    ctx.hint(ctx.mode === 'camera' ? s.hint : s.mouseHint);
    ctx.$('.target').textContent = TARGET;
    const counter = new PinchCounter();
    let added = 0, done = false;
    values.set({ spicesAdded: 0 });

    const addSpice = () => {
      if (done) return;
      added += 1;
      values.set({ spicesAdded: added });
      ctx.$('.count').textContent = added;
      ctx.progress(Math.min(1, added / TARGET));
      const box = ctx.$('.particles');
      for (let i = 0; i < 16; i++) {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('r', 2 + Math.random() * 2.5); c.setAttribute('cx', 320); c.setAttribute('cy', 80);
        c.setAttribute('fill', gsap.utils.random(['#c4623a', '#d9a03a', '#8a3b1a']));
        box.appendChild(c);
        gsap.to(c, { attr: { cx: 320 + gsap.utils.random(-50, 50), cy: 190 }, duration: gsap.utils.random(0.5, 0.8), ease: 'power2.in', onComplete: () => c.remove() });
      }
      gsap.to(ctx.$('.curry'), { attr: { fill: gsap.utils.interpolate('#e8c27a', '#b5521f', Math.min(1, added / 4)) }, duration: 0.8, delay: 0.5 });
      if (added === TARGET) { done = true; ctx.say(s.done); ctx.later(() => ctx.next(), 2000); }
    };

    ctx.on('shape', conf => { if (counter.update(conf)) addSpice(); });
    ctx.listen(ctx.$('.scene'), 'click', () => { if (ctx.mode === 'mouse') addSpice(); });
  }
};
