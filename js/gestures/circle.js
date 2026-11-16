// Circular motion tracker (from experiments/e4-circles, v2 — 16 Nov).
//
// v1 used the mean of the last 1.5 s as the centre. That only works when the window holds a
// whole circle: slow circles (≥ 4 s per turn, which is what mom asks for) stopped counting.
// v2 fits a circle through the points (least squares), so a part of a circle is enough.
//
// v1 also divided the absolute pixel position by the *current* palm size. When the hand tilts while
// circling, the palm size changes with the circle and the path gets extra loops (E4 test 16 Nov:
// 5 circles → 16 turns). v2 measures angles in plain pixels (an angle doesn't depend on distance to
// the camera) and uses the palm size — median over the window — only for the radius check.
//
// A movement counts while:
//   - the fitted radius is between minRadius and maxRadius (palms)
//   - the points lie close to that circle (CV of the distances ≤ maxCv)
//   - the path is not a line (flatness: short axis ÷ long axis of the point cloud ≥ minFlat)
// The angle is summed with its sign, so going back and forth cancels out.
import { palmSize, palmCentre } from './hand.js';

// Least-squares circle (Kåsa): x² + y² + Dx + Ey + F = 0
function fitCircle(raw) {
  // Work relative to the mean so the numbers stay small (pixels around 320 make the sums huge)
  const mx = raw.reduce((s, p) => s + p.x, 0) / raw.length, my = raw.reduce((s, p) => s + p.y, 0) / raw.length;
  const pts = raw.map(p => ({ x: p.x - mx, y: p.y - my }));
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  const n = pts.length;
  for (const { x, y } of pts) {
    const z = x * x + y * y;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z;
  }
  // Normal equations for [D, E, F]
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const b = [-sxz, -syz, -sz];
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A);
  if (Math.abs(d) < 1e-12) return null;
  const col = (i) => A.map((row, r) => row.map((v, c) => (c === i ? b[r] : v)));
  const D = det(col(0)) / d, E = det(col(1)) / d, F = det(col(2)) / d;
  const cx = -D / 2, cy = -E / 2, r2 = cx * cx + cy * cy - F;
  return r2 > 0 ? { cx: cx + mx, cy: cy + my, r: Math.sqrt(r2) } : null;
}

// Angle difference in -π..π; a jump of more than `limit` rad is a glitch, not a movement.
// After a gap of missed frames the limit grows with the time that passed (up to 2.6 rad, safely below π).
function wrap(dA, limit = 1.2) {
  if (dA > Math.PI) dA -= 2 * Math.PI;
  if (dA < -Math.PI) dA += 2 * Math.PI;
  return Math.abs(dA) > limit ? 0 : dA;
}

// Short axis ÷ long axis of the point cloud (0 = a line, 1 = round)
function flatness(pts) {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
  let a = 0, b = 0, c = 0;
  for (const p of pts) { const dx = p.x - mx, dy = p.y - my; a += dx * dx; b += dx * dy; c += dy * dy; }
  a /= n; b /= n; c /= n;
  const tr = a + c, disc = Math.sqrt(Math.max(0, (a - c) ** 2 / 4 + b * b));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  return l1 > 0 ? Math.sqrt(Math.max(0, l2) / l1) : 0;
}

export class CircleTracker {
  constructor(opts = {}) {
    this.o = { window: 2500, minRadius: 0.35, maxRadius: 4, maxCv: 0.3, minFlat: 0.25, lockFrames: 10, maxGap: 300, ...opts };
    this.reset();
  }
  reset() {
    this.pts = []; this.total = 0; this.lastAngle = null; this.turnLog = []; this.scale = 1;
    this.cx = 0; this.cy = 0; this.r = 0; this.cv = 1; this.flat = 0; this.round = false; this.locked = false; this.streak = 0; this.countedUntil = 0;
  }
  lose() { this.pts = []; this.lastAngle = null; this.round = false; this.locked = false; this.streak = 0; }
  // A frame without a hand. Fast movement blurs the hand and HandPose misses it in up to ~40% of
  // frames (E4 test 16 Nov), so short gaps are bridged; only a gap longer than maxGap starts over.
  miss(now = performance.now()) {
    const last = this.pts.at(-1);
    if (!last || now - last.t > this.o.maxGap) this.lose();
  }

  // From a hand: palm centre in pixels, palm size as the scale
  updateHand(hand, now, counts = true) {
    if (!hand) { this.miss(now); return 0; }
    const c = palmCentre(hand.keypoints);
    return this.add(c.x, c.y, now, counts, palmSize(hand.keypoints));
  }

  // x, y in any unit (pixels); scale = how many of those units make one palm (mouse mode: 40 px)
  add(x, y, now = performance.now(), counts = true, scale = 1) {
    const o = this.o;
    this.pts.push({ x, y, t: now, s: scale });
    while (this.pts.length && now - this.pts[0].t > o.window) this.pts.shift();
    if (this.pts.length < 10) { this.lastAngle = null; this.round = false; return 0; }

    const fit = fitCircle(this.pts);
    this.flat = flatness(this.pts);
    const scales = this.pts.map(p => p.s).sort((a, b) => a - b);
    this.scale = scales[Math.floor(scales.length / 2)] || 1;   // median palm size in the window
    if (fit) {
      this.cx = fit.cx; this.cy = fit.cy; this.r = fit.r / this.scale;   // radius in palms
      const d = this.pts.map(p => Math.hypot(p.x - fit.cx, p.y - fit.cy));
      this.cv = Math.sqrt(d.reduce((s, v) => s + (v - fit.r) ** 2, 0) / d.length) / fit.r;
    } else { this.r = 0; this.cv = 1; }
    this.round = !!fit && this.r >= o.minRadius && this.r <= o.maxRadius && this.cv <= o.maxCv && this.flat >= o.minFlat;

    // Hysteresis: lock on after `lockFrames` round frames in a row, let go after as many non-round ones.
    // (A wave flickers in and out of "round"; a real circle stays round.)
    this.streak = this.round === this.locked ? 0 : this.streak + 1;
    if (this.streak >= o.lockFrames) {
      this.locked = !this.locked; this.streak = 0;
      // Just locked on: count the arc already in the window (otherwise ~0.4 turn is lost at every start)
      if (this.locked && counts) {
        for (let i = 1; i < this.pts.length - 1; i++) if (this.pts[i - 1].t >= this.countedUntil) this.total += wrap(Math.atan2(this.pts[i].y - this.cy, this.pts[i].x - this.cx) - Math.atan2(this.pts[i - 1].y - this.cy, this.pts[i - 1].x - this.cx));
        this.lastAngle = Math.atan2(this.pts.at(-2).y - this.cy, this.pts.at(-2).x - this.cx);
      }
    }

    const angle = Math.atan2(y - this.cy, x - this.cx);
    let dA = 0;
    if (this.lastAngle !== null) {
      const dt = now - this.pts.at(-2).t;
      dA = wrap(angle - this.lastAngle, Math.min(2.6, Math.max(1.2, 1.2 * dt / 40)));
    }
    this.lastAngle = angle;
    if (!this.locked || !counts) return 0;
    this.total += dA;
    this.countedUntil = now;   // never count these points again when re-locking
    this.turnLog.push({ t: now, dA });
    while (this.turnLog.length && now - this.turnLog[0].t > 1000) this.turnLog.shift();
    return dA;
  }
  get turns() { return Math.abs(this.total) / (2 * Math.PI); }
  get speed() { return Math.abs(this.turnLog.reduce((s, e) => s + e.dA, 0)) / (2 * Math.PI); }   // turns per second
  get dir() { return this.total === 0 ? '–' : (this.total > 0 ? 'clockwise' : 'anticlockwise'); }
}
