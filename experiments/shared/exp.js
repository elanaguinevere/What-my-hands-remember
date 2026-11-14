// Shared helpers for the experiment pages (classic script → window.Exp).
// Everything here is ported from E1/E2 so the new experiments behave the same way.
(function () {
  const $ = id => document.getElementById(id);

  // Start the webcam on a <video>; sets the explicit width/height the TF.js models need.
  async function startCamera(video, overlay) {
    if (!window.isSecureContext) { const e = new Error('insecure'); e.name = 'InsecureContext'; throw e; }
    if (!navigator.mediaDevices?.getUserMedia) { const e = new Error('no getUserMedia'); e.name = 'NotSupportedError'; throw e; }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    video.srcObject = stream;
    await video.play();
    video.width = video.videoWidth;      // without these, the model sees a 0×0 image
    video.height = video.videoHeight;
    if (overlay) { overlay.width = video.videoWidth; overlay.height = video.videoHeight; }
    return stream;
  }

  function cameraMessage(err) {
    if (err.name === 'TypeError' && /fetch|network/i.test(err.message)) return 'The model files could not be downloaded (no internet, or the CDN is blocked on this network).';
    return {
      InsecureContext: 'This page is not on https or localhost, so the browser blocks the camera.',
      NotSupportedError: 'This browser has no camera API.',
      NotAllowedError: 'You blocked the camera. Allow it via the camera icon in the address bar.',
      NotFoundError: 'No camera was found.',
      NotReadableError: 'The camera is busy in another app (Zoom, Teams…).',
      OverconstrainedError: 'The camera does not support 640×480.',
      TimeoutError: 'The model took too long to load.'
    }[err.name] || `Something went wrong: ${err.name}: ${err.message}`;
  }

  // Reject if a promise takes longer than ms (used for model loading)
  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => { const e = new Error(`timeout after ${ms} ms`); e.name = 'TimeoutError'; rej(e); }, ms))]);
  }

  // Detection results per second over the last 2 seconds
  function fpsMeter() {
    const times = [];
    return {
      tick(now = performance.now()) { times.push(now); while (now - times[0] > 2000) times.shift(); },
      get value() { const n = times.length; return n > 1 ? (n - 1) / ((times[n - 1] - times[0]) / 1000) : 0; }
    };
  }

  // Palm size = wrist → base of the middle finger. Everything is measured in palms.
  function palmSize(kp) { return Math.hypot(kp[9].x - kp[0].x, kp[9].y - kp[0].y) || 1; }

  // 42 numbers: the 21 keypoints relative to the wrist, divided by palm size
  function handFeatures(kp) {
    const p = palmSize(kp), out = [];
    for (const k of kp) out.push((k.x - kp[0].x) / p, (k.y - kp[0].y) / p);
    return out;
  }

  // Simple shape heuristics (no training needed) — the fallback for the classifier
  function openness(kp) {   // avg fingertip → wrist distance in palms: ~0.9 fist, ~1.9 open
    const p = palmSize(kp);
    return [8, 12, 16, 20].reduce((s, i) => s + Math.hypot(kp[i].x - kp[0].x, kp[i].y - kp[0].y) / p, 0) / 4;
  }
  function pinchDistance(kp) { return Math.hypot(kp[4].x - kp[8].x, kp[4].y - kp[8].y) / palmSize(kp); }

  function drawHand(ctx, kp, color = '#0088FF') {
    ctx.fillStyle = color;
    kp.forEach((p, i) => { ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 8 : 4, 0, Math.PI * 2); ctx.fill(); });
  }

  // Append-only log panel + copy button
  function makeLog(el) {
    return {
      line(text) {
        if (el.dataset.started !== '1') { el.textContent = ''; el.dataset.started = '1'; }
        el.textContent += text + '\n';
        el.scrollTop = el.scrollHeight;
      },
      copy() { return navigator.clipboard.writeText(el.textContent); }
    };
  }

  // Wire range inputs: <input id="tKey"> + <span id="vKey"> → settings.Key
  function bindSliders(keys, settings) {
    for (const key of keys) {
      const input = $('t' + key);
      const read = () => { settings[key] = parseFloat(input.value); $('v' + key).textContent = input.value; };
      input.addEventListener('input', read);
      read();
    }
    return settings;
  }

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const median = arr => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

  window.Exp = { $, startCamera, cameraMessage, withTimeout, fpsMeter, palmSize, handFeatures, openness, pinchDistance, drawHand, makeLog, bindSliders, clamp, lerp, median };
})();
