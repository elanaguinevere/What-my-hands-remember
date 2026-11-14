import { story } from '../story.js';
import { machines } from '../state.js';
import { classifier } from '../ml/classifier.js';

export default {
  id: 'finale',
  detector: null,
  enter(ctx) {
    const line = ctx.$('.finale-line');
    line.textContent = story.finale.line;
    const split = SplitText.create(line, { type: 'words', mask: 'words' });
    ctx.cleanup(() => split.revert());
    gsap.from(split.words, { yPercent: 100, stagger: 0.14, duration: 0.9, ease: 'power2.out', delay: 0.4 });

    const again = ctx.$('button');
    again.textContent = story.finale.again;
    ctx.listen(again, 'click', () => {
      // A new visitor teaches it new hands; camera choice is kept
      classifier.reset();
      machines.flow.send('RESTART');
    });
  }
};
