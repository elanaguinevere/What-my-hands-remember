import { story } from '../story.js';

export default {
  id: 'intro',
  detector: null,
  enter(ctx) {
    const s = story.intro;
    ctx.$('h1').textContent = s.title;
    ctx.$('.sub').textContent = s.sub;
    ctx.$('.lead').textContent = s.lead;
    const btn = ctx.$('button');
    btn.textContent = s.button;
    ctx.listen(btn, 'click', () => ctx.next());

    // SplitText: the title letter by letter (calmer when the visitor prefers reduced motion)
    const split = SplitText.create(ctx.$('h1'), { type: 'chars', mask: 'chars' });
    ctx.cleanup(() => split.revert());
    gsap.from(split.chars, { yPercent: ctx.reducedMotion ? 0 : 100, opacity: 0, stagger: ctx.reducedMotion ? 0 : 0.035, duration: 0.8, ease: 'power3.out', delay: 0.3 });
    gsap.from([ctx.$('.sub'), ctx.$('.lead'), btn], { opacity: 0, y: 12, stagger: 0.15, delay: 0.9 });
  }
};
