// "Show me how you hold your hands": record open / fist / pinch, train, continue.
// State lives in machines.classifier (untrained → collecting ⇄ recording → training → ready).
import { story } from '../story.js';
import { machines, values, enoughSamples, MIN_SAMPLES } from '../state.js';
import { classifier, LABELS } from '../ml/classifier.js';

export default {
  id: 'teach',
  detector: 'hand',
  enter(ctx) {
    const s = story.teach;
    ctx.$('h2').textContent = s.title;
    ctx.$('.lead').textContent = s.lead;
    const msg = ctx.$('.message');
    const trainBtn = ctx.$('[data-act="train"]'), skipBtn = ctx.$('[data-act="skip"]');
    trainBtn.textContent = s.train; skipBtn.textContent = s.skip;
    machines.classifier.send('COLLECT');

    const box = ctx.$('.shapes');
    box.innerHTML = LABELS.map(l => `<button class="secondary" data-label="${l}">${s.shapes[l]} <b data-count="${l}">0</b></button>`).join('');
    const render = () => {
      const c = values.get().samples;
      LABELS.forEach(l => { ctx.$(`[data-count="${l}"]`).textContent = `${c[l]}/${MIN_SAMPLES}`; });
      const busy = machines.classifier.is('recording', 'training');
      box.querySelectorAll('button').forEach(b => b.disabled = busy);
      trainBtn.disabled = busy || !enoughSamples();
    };
    ctx.cleanup(values.subscribe(render));
    ctx.cleanup(machines.classifier.subscribe(render));
    render();

    ctx.listen(box, 'click', async e => {
      const label = e.target.closest('button')?.dataset.label;
      if (!label || !machines.classifier.is('collecting')) return;
      for (const n of [3, 2, 1]) { msg.textContent = `${s.shapes[label]} in ${n}…`; await ctx.wait(700); }
      msg.textContent = 'Recording…';
      const before = values.get().samples[label];
      await classifier.record(label);
      const got = values.get().samples[label] - before;
      msg.textContent = got < 10 ? 'I couldn\'t see your hand well. Try again, a bit closer to the camera.' : `Got it (${got}).`;
    });

    ctx.listen(trainBtn, 'click', async () => {
      msg.textContent = s.training;
      try {
        await classifier.train({ onEpoch: (ep) => { msg.textContent = `${s.training} ${Math.round((ep + 1) / 40 * 100)}%`; } });
        ctx.next();
      } catch (err) {
        console.error(err);
        msg.textContent = 'That didn\'t work. Record the shapes again, or skip.';
      }
    });
    ctx.listen(skipBtn, 'click', () => { classifier.useRules = true; ctx.next(); });
  }
};
