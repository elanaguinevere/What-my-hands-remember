// Choose camera or mouse. Camera path: permission → camera on → HandPose loaded → next.
// Any failure ends in a clear sentence + "continue with my mouse".
import { story } from '../story.js';
import { machines } from '../state.js';
import { startCamera } from '../input/camera.js';
import { loadHandPose } from '../input/models.js';
import { explainError } from '../core/system-check.js';

export default {
  id: 'setup',
  detector: null,
  enter(ctx) {
    const s = story.setup;
    ctx.$('h2').textContent = s.title;
    ctx.$('.lead').textContent = s.lead;
    const camBtn = ctx.$('[data-act="camera"]'), mouseBtn = ctx.$('[data-act="mouse"]');
    camBtn.textContent = s.camera; mouseBtn.textContent = s.mouse;
    const msg = ctx.$('.message');

    // Show warnings from the system check (no https, no camera, slow GPU, small screen…)
    const fails = ctx.values.get().warnings;
    ctx.$('.checks').innerHTML = fails.map(w => `<li class="${w.status}">${w.label}: ${w.detail}${w.fix ? ` — ${w.fix}` : ''}</li>`).join('');
    const cameraImpossible = fails.some(w => w.status === 'fail' && ['secure', 'camera-api', 'camera-count'].includes(w.id));
    camBtn.disabled = cameraImpossible;
    if (cameraImpossible) msg.textContent = 'Your camera can\'t be used here, but you can cook with your mouse.';

    ctx.listen(camBtn, 'click', async () => {
      camBtn.disabled = mouseBtn.disabled = true;
      machines.input.send('CAMERA');
      msg.textContent = s.loading;
      try {
        if (!machines.camera.is('on')) await startCamera();   // after "Begin again" the camera is still on
        await loadHandPose();
        msg.textContent = s.ready;
        ctx.later(() => ctx.next(), 900);
      } catch (err) {
        console.error(err);
        msg.textContent = explainError(err);
        machines.input.send('FALLBACK');
        mouseBtn.disabled = false;
        camBtn.disabled = machines.camera.is('insecure');
        camBtn.textContent = 'Try the camera again';
      }
    });
    ctx.listen(mouseBtn, 'click', () => { machines.input.send('MOUSE'); ctx.next(); });
  }
};
