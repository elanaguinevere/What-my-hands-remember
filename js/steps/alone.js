// 6 · On your own: the page becomes scrollable. ScrollTrigger scrubs her kitchen into mine at night,
// the recipe card wipes blank (DrawSVG), the lines appear one by one. Reaching the end → finale.
import { story } from '../story.js';

export default {
  id: 'alone',
  detector: null,
  scroll: true,                       // the step runner unlocks page scrolling for this step
  enter(ctx) {
    const lines = ctx.$('.lines');
    lines.innerHTML = story.alone.lines.map(l => `<p>${l}</p>`).join('');
    ctx.hint(story.alone.hint);
    window.scrollTo(0, 0);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ctx.el, start: 'top top', end: 'bottom bottom', scrub: 1,
        onUpdate: self => ctx.progress(self.progress),
        onLeave: () => ctx.next()
      }
    });
    tl.to(ctx.$('.her-kitchen'), { opacity: 0, duration: 1 })
      .to(ctx.$('.lamp'), { opacity: 1, duration: 1 }, '<.3')
      .fromTo(ctx.$$('.recipe path'), { drawSVG: '100%' }, { drawSVG: '100% 100%', stagger: 0.15, duration: 0.5 }, '<.3');
    ctx.$$('.lines p').forEach((p, i) => tl.fromTo(p, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, 0.6 + i * 0.5));
    ctx.cleanup(() => { tl.scrollTrigger?.kill(); tl.kill(); });
  }
};
