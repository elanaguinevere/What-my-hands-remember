// 4 · Stir: slow circles with an open hand. Turns → thicker/darker curry (accumulate),
// turning speed → steam (continuous), too fast → mom slows you down (state).
// FaceMesh starts loading here, so it is ready for tasting.
import { story } from '../story.js';
import { CircleTracker } from '../gestures/circle.js';
import { openness } from '../gestures/hand.js';
import { Mapping } from '../core/mapping.js';
import { loadFaceMesh } from '../input/models.js';

const GOAL = 8, TOO_FAST = 1.5;

export default {
  id: 'stir',
  detector: 'hand',
  enter(ctx) {
    const s = story.stir;
    ctx.say(s.mom);
    ctx.hint(ctx.mode === 'camera' ? s.hint : s.mouseHint);
    if (ctx.mode === 'camera') loadFaceMesh().catch(err => console.warn('FaceMesh preload failed', err));

    const tracker = new CircleTracker();
    const curry = ctx.$('.curry');
    const colour = gsap.utils.interpolate('#e6b85c', '#9c4a1c');
    const steam = new Mapping({ inMin: 0.2, inMax: 1.2, curve: 'power2.out', target: ctx.$('.steam'), prop: 'opacity', smooth: 0.8, type: 'continuous' });
    const thickness = new Mapping({ inMin: 0, inMax: GOAL, curve: 'sine.inOut', type: 'accumulate', apply: v => curry.setAttribute('fill', colour(v)) });
    let done = false, fastSince = null;

    const render = () => {
      const now = performance.now();
      thickness.update(tracker.turns);
      steam.update(tracker.speed);
      gsap.set(ctx.$('.swirl'), { rotation: tracker.total * 28.6, svgOrigin: '320 170' });
      ctx.progress(Math.min(1, tracker.turns / GOAL));
      const fast = tracker.speed > TOO_FAST;
      fastSince = fast ? fastSince ?? now : null;
      ctx.el.classList.toggle('too-fast', fastSince !== null && now - fastSince > 300);
      if (tracker.turns >= GOAL && !done) { done = true; ctx.say(s.done); ctx.later(() => ctx.next(), 1800); }
    };

    ctx.on('hand', hand => {
      const open = hand && openness(hand.keypoints) >= 1.25;
      tracker.updateHand(hand, performance.now(), open);
      render();
    });
    ctx.listen(ctx.$('.scene'), 'mousemove', e => {
      if (ctx.mode !== 'mouse') return;
      const r = ctx.$('.scene').getBoundingClientRect();   // not e.offsetX (unreliable on SVG children)
      tracker.add((e.clientX - r.left) / 40, (e.clientY - r.top) / 40);
      render();
    });
    ctx.cleanup(() => ctx.el.classList.remove('too-fast'));
  }
};
