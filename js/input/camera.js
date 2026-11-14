// Webcam life cycle → machines.camera
import { machines, values } from '../state.js';
import { watchCamera } from '../core/system-check.js';

export const video = document.getElementById('video');
let stream = null;

const EVENT_FOR_ERROR = {
  InsecureContext: 'INSECURE', NotAllowedError: 'DENIED', SecurityError: 'DENIED',
  NotFoundError: 'NOT_FOUND', OverconstrainedError: 'NOT_FOUND', NotReadableError: 'BUSY', AbortError: 'BUSY'
};

export async function startCamera() {
  machines.camera.send(machines.camera.is('idle') ? 'REQUEST' : 'RETRY');
  try {
    if (!window.isSecureContext) { const e = new Error('not https'); e.name = 'InsecureContext'; throw e; }
    if (!navigator.mediaDevices?.getUserMedia) { const e = new Error('no camera API'); e.name = 'NotSupportedError'; throw e; }
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
    video.width = video.videoWidth;      // without these, TF.js sees a 0×0 image
    video.height = video.videoHeight;
    watchCamera(stream, reason => { if (machines.camera.is('on')) machines.camera.send('LOST', { reason }); });
    machines.camera.send('GRANTED');
    return stream;
  } catch (err) {
    values.set({ lastError: { name: err.name, message: err.message } });
    machines.camera.send(EVENT_FOR_ERROR[err.name] || 'ERROR', { error: err });
    throw err;
  }
}

export function stopCamera() {
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  video.srcObject = null;
  machines.camera.send('STOP');
}
