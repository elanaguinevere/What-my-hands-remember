// Chop detector (ported from experiments/1-ml5/e2-chop).
// ready → (fast down) → down → (fast up, dropped far enough) → chop → ready
// "Too fast" counts every fast downward stroke (> fast per second), separately from chops.
import { palmSize } from './hand.js';

export class ChopDetector {
  constructor(opts = {}) {
    this.o = { down: 2.5, up: 0.5, drop: 2, fast: 3.5, smooth: 0.5, ...opts };
    this.reset();
  }
  reset() {
    this.state = 'ready'; this.smoothY = null; this.lastY = null; this.lastT = null; this.speed = 0;
    this.topY = null; this.bottomY = null; this.strokeTimes = []; this.strokeDir = null; this.tooFast = false;
  }
  lose() { const keep = this.strokeTimes; this.reset(); this.strokeTimes = keep; }

  // Returns 'chop' | 'too-fast' | null
  update(hand, now = performance.now()) {
    if (!hand) { this.lose(); return null; }
    const o = this.o, kp = hand.keypoints;
    const y = kp[0].y / palmSize(kp);
    this.smoothY = this.smoothY === null ? y : this.smoothY * o.smooth + y * (1 - o.smooth);
    if (this.lastY !== null && now > this.lastT) this.speed = (this.smoothY - this.lastY) / ((now - this.lastT) / 1000);
    this.lastY = this.smoothY; this.lastT = now;

    let event = null;
    if (this.speed > o.down && this.strokeDir !== 'down') {
      this.strokeDir = 'down';
      this.strokeTimes = [...this.strokeTimes.filter(t => now - t < 1000), now];
      if (this.strokeTimes.length > o.fast && !this.tooFast) { this.tooFast = true; event = 'too-fast'; }
    } else if (this.speed < -o.down) this.strokeDir = 'up';

    // "too fast" switches off once clearly below the limit
    this.strokeTimes = this.strokeTimes.filter(t => now - t < 1000);
    if (this.tooFast && this.strokeTimes.length <= o.fast - 1) this.tooFast = false;
    if (this.tooFast) { this.state = 'ready'; this.topY = this.smoothY; return event; }

    if (this.state === 'ready') {
      if (this.topY === null || this.smoothY < this.topY) this.topY = this.smoothY;
      if (this.speed > o.down) { this.state = 'down'; this.bottomY = this.smoothY; }
    } else if (this.state === 'down') {
      this.bottomY = Math.max(this.bottomY, this.smoothY);
      if (this.speed < -o.up) {
        if (this.bottomY - this.topY >= o.drop) event = 'chop';
        this.state = 'ready'; this.topY = this.smoothY;
      }
    }
    return event;
  }
}
