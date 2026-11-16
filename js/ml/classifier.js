// Self-trained hand-shape classifier: open / fist / pinch (ported from experiments/1-ml5/e5-pinch-classifier).
// Until it is trained (or in "simple rules" mode) it falls back to the distance heuristic,
// so the spices step always works.
import { machines, values, MIN_SAMPLES } from '../state.js';
import { handFeatures, heuristicShape } from '../gestures/hand.js';

export const LABELS = ['open', 'fist', 'pinch'];

class HandShapeClassifier {
  constructor() { this.samples = []; this.nn = null; this.recordingLabel = null; this.useRules = false; }

  addSample(label, keypoints) {
    this.samples.push({ label, features: handFeatures(keypoints) });
    const counts = { open: 0, fist: 0, pinch: 0 };
    this.samples.forEach(s => counts[s.label]++);
    values.set({ samples: counts });
  }

  // 3-2-1 handled by the step; this records for `ms` while the hand callback calls addSample
  async record(label, ms = 2500) {
    machines.classifier.send('COLLECT');           // no-op if already collecting
    if (!machines.classifier.send('RECORD')) return;
    this.recordingLabel = label;
    await new Promise(r => setTimeout(r, ms));
    this.recordingLabel = null;
    machines.classifier.send('RECORDED');
  }

  async train({ epochs = 40, batchSize = 16, onEpoch } = {}) {
    if (!machines.classifier.send('TRAIN')) throw new Error(`need at least ${MIN_SAMPLES} samples of each shape`);
    try {
      if (ml5.tf?.ready) await ml5.tf.ready();   // TF.js backend must be initialised (E5, 16 Nov)
      this.nn = ml5.neuralNetwork({ task: 'classification', debug: false });   // not a promise
      for (const s of this.samples) this.nn.addData(s.features, [s.label]);
      this.nn.normalizeData();
      await new Promise(resolve => this.nn.train({ epochs, batchSize },
        (epoch, logs) => onEpoch?.(epoch, typeof logs === 'number' ? logs : logs?.loss), resolve));
      machines.classifier.send('TRAINED');
    } catch (err) {
      machines.classifier.send('FAILED', { error: err });
      throw err;
    }
  }

  // → Promise<{ open, fist, pinch }>
  classify(keypoints) {
    if (this.useRules || !machines.classifier.is('ready')) return Promise.resolve(heuristicShape(keypoints));
    return new Promise(resolve => {
      this.nn.classify(handFeatures(keypoints), (a, b) => {
        const results = Array.isArray(a) ? a : b;          // ml5 1.x: results first
        if (!results) return resolve(null);
        const conf = { open: 0, fist: 0, pinch: 0 };
        results.forEach(r => { conf[r.label] = r.confidence; });
        resolve(conf);
      });
    });
  }

  reset() {
    this.samples = []; this.nn = null; this.recordingLabel = null;
    values.set({ samples: { open: 0, fist: 0, pinch: 0 } });
    if (machines.classifier.is('ready')) machines.classifier.send('RETRAIN');
  }
}

export const classifier = new HandShapeClassifier();
