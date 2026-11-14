// Detects technical limitations before and during the experience.
// Every check returns { id, label, status: 'ok' | 'warn' | 'fail', detail, fix }.
// 'fail' on a camera check means: go to mouse mode. 'warn' means: tell the visitor, keep going.
// Used by experiments/e9-limitations and by the app (js/main.js).

const result = (id, label, status, detail, fix = '') => ({ id, label, status, detail, fix });

// ---------- Before anything loads (instant, no permission needed) ----------
export async function staticChecks({ minWidth = 1024, minHeight = 600, libs = {} } = {}) {
  const out = [];

  // 1. https / localhost — browsers only give the camera to secure pages
  if (location.protocol === 'file:') out.push(result('secure', 'Served over http(s)', 'fail', 'Opened as a file (file://): the camera and ES modules are blocked.', 'Run `npx serve` in the project folder and open the localhost URL.'));
  else if (!window.isSecureContext) out.push(result('secure', 'Secure context', 'fail', `${location.protocol}//${location.host} is not https.`, 'Host on https (the school hosting has a certificate) or use localhost.'));
  else out.push(result('secure', 'Secure context', 'ok', `${location.protocol}//${location.host}`));

  // 2. Camera API
  const hasGUM = !!navigator.mediaDevices?.getUserMedia;
  out.push(hasGUM ? result('camera-api', 'Camera API', 'ok', 'getUserMedia available')
                  : result('camera-api', 'Camera API', 'fail', 'This browser has no getUserMedia.', 'Mouse mode. Suggest a recent Chrome, Edge or Firefox.'));

  // 3. Is there a camera at all? (labels stay empty until permission is given, the count doesn't)
  if (hasGUM && navigator.mediaDevices.enumerateDevices) {
    try {
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      out.push(cams.length ? result('camera-count', 'Camera present', 'ok', `${cams.length} camera(s)`)
                           : result('camera-count', 'Camera present', 'fail', 'No camera found.', 'Mouse mode from the start, with a short note why.'));
    } catch { out.push(result('camera-count', 'Camera present', 'warn', 'Could not list devices.')); }
  }

  // 4. Permission state (Chrome/Edge; Firefox and Safari may not support the query)
  try {
    const p = await navigator.permissions.query({ name: 'camera' });
    const status = { granted: 'ok', prompt: 'ok', denied: 'fail' }[p.state] || 'warn';
    out.push(result('camera-permission', 'Camera permission', status, p.state,
      p.state === 'denied' ? 'Show how to unblock it (camera icon in the address bar), offer mouse mode.' : p.state === 'prompt' ? 'Explain why before the browser asks.' : ''));
  } catch { out.push(result('camera-permission', 'Camera permission', 'ok', 'unknown until asked (browser has no permission query)')); }

  // 5. GPU: decides how fast the models run (E1: webgpu ~50 fps, webgl ~22 fps, cpu 0.5 fps)
  let webgpu = false, webgl2 = false, renderer = '';
  try { webgpu = !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch { /* not available */ }
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    webgl2 = !!gl;
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();   // free the test context
  } catch { /* not available */ }
  const softwareGL = /swiftshader|llvmpipe|software/i.test(renderer);
  if (webgpu) out.push(result('gpu', 'GPU for the models', 'ok', `WebGPU${renderer ? ' · ' + renderer : ''}`));
  else if (webgl2 && !softwareGL) out.push(result('gpu', 'GPU for the models', 'warn', `WebGL only${renderer ? ' · ' + renderer : ''} (≈ 20 fps in E1)`, 'Use HandPose "lite" and detect a bit less often.'));
  else out.push(result('gpu', 'GPU for the models', 'fail', softwareGL ? `Software rendering (${renderer})` : 'No WebGPU or WebGL2', 'TF.js falls back to CPU (0.5 fps in E1): offer mouse mode, or turn on hardware acceleration in the browser settings.'));

  // 6. Hardware hints (not all browsers report these)
  const cores = navigator.hardwareConcurrency || 0, mem = navigator.deviceMemory || 0;
  out.push(result('hardware', 'Processor / memory', (cores && cores < 4) || (mem && mem < 4) ? 'warn' : 'ok',
    `${cores || '?'} cores · ${mem ? mem + ' GB+' : '? GB'} memory`, (cores && cores < 4) ? 'Load one model at a time and unload the previous one.' : ''));

  // 7. Screen size: desktop-only experience
  const w = innerWidth, h = innerHeight;
  out.push(w >= minWidth && h >= minHeight ? result('screen', 'Screen size', 'ok', `${w} × ${h}`)
    : result('screen', 'Screen size', 'warn', `${w} × ${h} (made for ≥ ${minWidth} × ${minHeight})`, 'Show "best on a laptop or desktop" with a "continue anyway" button.'));

  // 8. Reduced motion (accessibility): calmer animations, no shaking
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  out.push(result('motion', 'Reduced motion', reduced ? 'warn' : 'ok', reduced ? 'Visitor prefers reduced motion' : 'no preference', reduced ? 'gsap.matchMedia → shorter, calmer tweens (see E7).' : ''));

  // 9. Libraries (GSAP + plugins); ml5 is checked later because it is lazy-loaded
  for (const [name, ok] of Object.entries(libs)) {
    out.push(ok ? result('lib-' + name, name, 'ok', 'loaded')
                : result('lib-' + name, name, 'fail', 'did not load', name === 'gsap' ? 'Show the static text version of the story.' : 'Skip that effect, keep the story going.'));
  }
  return out;
}

// ---------- While the camera runs ----------

// Average brightness 0–255 of a small copy of the video frame.
const lightCanvas = document.createElement('canvas');
lightCanvas.width = 32; lightCanvas.height = 24;
const lightCtx = lightCanvas.getContext('2d', { willReadFrequently: true });
export function measureLight(video) {
  if (!video.videoWidth) return null;
  lightCtx.drawImage(video, 0, 0, 32, 24);
  const d = lightCtx.getImageData(0, 0, 32, 24).data;
  let sum = 0, centre = 0, edge = 0, nc = 0, ne = 0;
  for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4, l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    sum += l;
    if (x > 8 && x < 24 && y > 6 && y < 18) { centre += l; nc++; } else { edge += l; ne++; }
  }
  const avg = sum / (32 * 24), c = centre / nc, e = edge / ne;
  let status = 'ok', detail = `brightness ${avg.toFixed(0)}/255`, fix = '';
  if (avg < 50) { status = 'warn'; detail += ' · too dark'; fix = 'Turn on a light in front of you (not behind you).'; }
  else if (avg > 225) { status = 'warn'; detail += ' · overexposed'; fix = 'Too much light straight into the camera.'; }
  else if (e - c > 60) { status = 'warn'; detail += ' · backlit (window behind you?)'; fix = 'Turn so the light falls on your hands, not into the camera.'; }
  return { avg, status, detail, fix };
}

// Hand framing: too far, too close, or cut off at the edge of the image
export function checkHandFraming(hand, width, height) {
  if (!hand) return result('framing', 'Hand', 'warn', 'no hand seen', 'Hold your hand up in front of the camera.');
  const kp = hand.keypoints;
  const palm = Math.hypot(kp[9].x - kp[0].x, kp[9].y - kp[0].y);
  const margin = 0.03;
  const atEdge = kp.some(p => p.x < width * margin || p.x > width * (1 - margin) || p.y < height * margin || p.y > height * (1 - margin));
  if (palm < 30) return result('framing', 'Hand', 'warn', `palm ${palm.toFixed(0)} px · too far`, 'Come a bit closer.');
  if (palm > 170) return result('framing', 'Hand', 'warn', `palm ${palm.toFixed(0)} px · too close`, 'Move your hand a bit back.');
  if (atEdge) return result('framing', 'Hand', 'warn', 'partly outside the image', 'Keep your hand in the middle.');
  return result('framing', 'Hand', 'ok', `palm ${palm.toFixed(0)} px · confidence ${(hand.confidence ?? 0).toFixed(2)}`);
}

// Detection speed: rolling fps with a verdict (thresholds from E1: < 20 fps feels laggy)
export function fpsVerdict(fps) {
  if (fps >= 20) return result('fps', 'Detection speed', 'ok', `${fps.toFixed(1)} fps`);
  if (fps >= 10) return result('fps', 'Detection speed', 'warn', `${fps.toFixed(1)} fps · laggy`, 'Switch to the lite model, close other tabs, plug in the laptop.');
  return result('fps', 'Detection speed', 'fail', `${fps.toFixed(1)} fps · too slow to play`, 'Offer mouse mode.');
}

// Which TF.js backend ml5 ended up with ('webgpu' | 'webgl' | 'cpu' | ...)
export function backendCheck() {
  let b = '';
  try { b = window.ml5?.tf?.getBackend?.() || ''; } catch { /* ml5 not loaded */ }
  if (!b) return result('backend', 'TF.js backend', 'warn', 'unknown (ml5 not loaded yet)');
  return result('backend', 'TF.js backend', b === 'cpu' ? 'fail' : 'ok', b, b === 'cpu' ? 'CPU only: way too slow. Offer mouse mode.' : '');
}

// Watch the camera: unplugged / taken by another app / revoked
export function watchCamera(stream, onLost) {
  for (const track of stream.getVideoTracks()) {
    track.addEventListener('ended', () => onLost('ended'));
    track.addEventListener('mute', () => onLost('muted'));
  }
  navigator.mediaDevices?.addEventListener?.('devicechange', async () => {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    if (!cams.length) onLost('unplugged');
  });
}

// Lazy-load a classic <script> (ml5 is 4.5 MB, only needed when the visitor picks the camera)
export function loadScript(src, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const abs = new URL(src, document.baseURI).href;
    if ([...document.scripts].some(s => s.src === abs)) return resolve();   // already loaded
    const s = document.createElement('script');
    const timer = setTimeout(() => { const e = new Error(`${src} took longer than ${timeoutMs / 1000} s`); e.name = 'TimeoutError'; reject(e); }, timeoutMs);
    s.src = src;
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); const e = new Error(`could not load ${src}`); e.name = 'NetworkError'; reject(e); };
    document.head.appendChild(s);
  });
}

// Promise with a deadline (model loading)
export function withTimeout(promise, ms, what = 'loading') {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => { const e = new Error(`${what} took longer than ${ms / 1000} s`); e.name = 'TimeoutError'; rej(e); }, ms))]);
}

// Turn a camera/model error into a sentence for the visitor
export function explainError(err) {
  if (err?.name === 'TypeError' && /fetch|network|load/i.test(err.message)) err = { name: 'NetworkError' };   // model weights are downloaded from a CDN
  return {
    InsecureContext: 'This page isn\'t on a secure connection, so your browser blocks the camera.',
    NotAllowedError: 'The camera is blocked. You can allow it with the camera icon in the address bar, or continue with your mouse.',
    NotFoundError: 'No camera was found. You can continue with your mouse.',
    NotReadableError: 'Your camera is busy in another app (Zoom, Teams…). Close it and try again, or continue with your mouse.',
    OverconstrainedError: 'Your camera doesn\'t support the needed size.',
    NotSupportedError: 'This browser can\'t use the camera. Try a recent Chrome, Edge or Firefox.',
    TimeoutError: 'Loading took too long. Your connection or computer may be slow.',
    NetworkError: 'Part of the site (the hand or face model) could not be downloaded. Check your connection, or continue with your mouse.'
  }[err?.name] || 'Something went wrong with the camera. You can continue with your mouse.';
}
