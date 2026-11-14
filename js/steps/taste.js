// 5 · Taste: calibrate (neutral) → smile = right → next; too spicy = yogurt (MotionPath) → taste again.
import { story } from '../story.js';
import { machines } from '../state.js';
import { TasteDetector } from '../gestures/taste.js';
import { loadFaceMesh } from '../input/models.js';

export default {
  id: 'taste',
  detector: 'face',
  enter(ctx) {
    const s = story.taste;
    ctx.say(s.mom);
    const taste = new TasteDetector();
    let done = false;

    if (ctx.mode === 'camera') {
      ctx.hint(s.calibrating);
      if (!machines.faceMesh.is('ready')) loadFaceMesh().catch(() => { ctx.hint(s.mouseHint); ctx.useMouse(); });
    } else ctx.hint(s.mouseHint);

    const spicy = () => {
      ctx.say(s.spicy);
      const spoon = ctx.$('.spoon');
      gsap.timeline()
        .set(spoon, { opacity: 1 })
        .to(spoon, { duration: 1.2, ease: 'power1.inOut', motionPath: { path: ctx.$('.yogurt-path'), align: ctx.$('.yogurt-path'), alignOrigin: [0.5, 0.5] } })
        .to(spoon, { rotation: -70, duration: 0.3 })
        .to(ctx.$('.curry'), { attr: { fill: '#c97a45' }, duration: 1 }, '<')
        .to(spoon, { opacity: 0, duration: 0.4 })
        .set(spoon, { clearProps: 'transform' })
        .add(() => ctx.say(s.mom));
    };
    const right = () => {
      if (done) return;
      done = true;
      ctx.say(s.right);
      ctx.progress(1);
      ctx.later(() => ctx.next(), 1600);
    };
    const handle = ev => {
      if (ev === 'calibrated') ctx.hint(s.hint);
      if (ev === 'too-spicy') spicy();
      if (ev === 'right') right();
      ctx.progress(Math.min(0.9, taste.warmth));
    };

    ctx.on('face', face => handle(taste.update(face)));

    // Mouse/keyboard: hold H (smile) or S (spicy); the on-screen buttons do the same
    const keys = {};
    ctx.listen(window, 'keydown', e => { keys[e.key.toLowerCase()] = true; });
    ctx.listen(window, 'keyup', e => { keys[e.key.toLowerCase()] = false; });
    ctx.$$('[data-face]').forEach(b => {
      ctx.listen(b, 'pointerdown', () => { keys[b.dataset.face] = true; });
      ctx.listen(b, 'pointerup', () => { keys[b.dataset.face] = false; });
      ctx.listen(b, 'pointerleave', () => { keys[b.dataset.face] = false; });
    });
    ctx.every(() => {
      if (ctx.mode !== 'mouse') return;
      taste.warmth += ((keys.h ? 1 : 0) - taste.warmth) * 0.15;
      taste.spicy += ((keys.s ? 1 : 0) - taste.spicy) * 0.25;
      handle(taste.decide());
    }, 50);
  }
};
