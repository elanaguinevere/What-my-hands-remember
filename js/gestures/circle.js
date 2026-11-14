// Circular motion tracker (ported from experiments/e4-circles).
// Keeps the last 1.5 s of palm positions, uses their mean as the centre, and adds up the
// angle around it while the path is round enough (CV) and big enough (radius).
import { palmSize, palmCentre } from './hand.js';

export class CircleTracker {
  constructor(opts = {}) {
    this.o = { window: 1500, minRadius: 0.35, maxCv: 0.45, ...opts };
    this.reset();
  }
  reset() { this.pts = []; this.total = 0; this.lastAngle = null; this.turnLog = []; this.cx = 0; this.cy = 0; this.r = 0; this.cv = 1; this.round = false; }
  lose() { this.pts = []; this.lastAngle = null; this.round = false; }

  // From a hand (palms) or from the mouse (pass x, y in "palm" units directly)
  updateHand(hand, now, counts = true) {
    if (!hand) { this.lose(); return 0; }
    const p = palmSize(hand.keypoints), c = palmCentre(hand.keypoints);
    return this.add(c.x / p, c.y / p, now, counts);
  }
  add(x, y, now = performance.now(), counts = true) {
    const o = this.o;
    this.pts.push({ x, y, t: now });
    while (this.pts.length && now - this.pts[0].t > o.window) this.pts.shift();
    if (this.pts.length < 8) { this.lastAngle = null; return 0; }
    const n = this.pts.length;
    this.cx = this.pts.reduce((s, p) => s + p.x, 0) / n;
    this.cy = this.pts.reduce((s, p) => s + p.y, 0) / n;
    const d = this.pts.map(p => Math.hypot(p.x - this.cx, p.y - this.cy));
    this.r = d.reduce((s, v) => s + v, 0) / n;
    this.cv = this.r ? Math.sqrt(d.reduce((s, v) => s + (v - this.r) ** 2, 0) / n) / this.r : 1;
    this.round = this.r >= o.minRadius && this.cv <= o.maxCv;

    const angle = Math.atan2(y - this.cy, x - this.cx);
    let dA = 0;
    if (this.lastAngle !== null) {
      dA = angle - this.lastAngle;
      if (dA > Math.PI) dA -= 2 * Math.PI;
      if (dA < -Math.PI) dA += 2 * Math.PI;
      if (Math.abs(dA) > 1.2) dA = 0;     // a jump, not a movement
    }
    this.lastAngle = angle;
    if (!this.round || !counts) return 0;
    this.total += dA;
    this.turnLog.push({ t: now, dA });
    while (this.turnLog.length && now - this.turnLog[0].t > 1000) this.turnLog.shift();
    return dA;
  }
  get turns() { return Math.abs(this.total) / (2 * Math.PI); }
  get speed() { return Math.abs(this.turnLog.reduce((s, e) => s + e.dA, 0)) / (2 * Math.PI); }   // turns per second
}
