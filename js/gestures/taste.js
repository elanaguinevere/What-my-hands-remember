// Tasting face (ported from experiments/e6-taste-facemesh).
// 40 neutral frames → baseline. Then:
//   warmth (smile) = (smile ratio / baseline − 1.04) / 0.14
//   spicy          = mouth opened AND eyes scrunched (both needed), damped while smiling (a laugh looks similar)
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = v => Math.min(1, Math.max(0, v));
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

export function measureFace(k) {
  const faceW = d(k[234], k[454]), faceH = d(k[10], k[152]);
  const lift = ((k[13].y + k[14].y) / 2 - (k[61].y + k[291].y) / 2) / faceH;
  return {
    ratio: d(k[61], k[291]) / faceW + 0.8 * lift,
    open: d(k[13], k[14]) / faceH,
    eye: (d(k[159], k[145]) / d(k[33], k[133]) + d(k[386], k[374]) / d(k[362], k[263])) / 2
  };
}

export class TasteDetector {
  constructor(opts = {}) {
    this.o = { calFrames: 40, warm: 0.72, warmHold: 1200, open: 0.06, squint: 0.22, spicyHold: 600, cooldown: 3000, ...opts };
    this.recalibrate();
  }
  recalibrate() { this.cal = null; this.frames = []; this.warmth = 0; this.spicy = 0; this.warmSince = null; this.spicySince = null; this.until = 0; }
  get calibrated() { return !!this.cal; }
  get progress() { return this.cal ? 1 : this.frames.length / this.o.calFrames; }

  // Returns 'calibrated' | 'right' | 'too-spicy' | null
  update(face, now = performance.now()) {
    if (!face) { this.warmSince = this.spicySince = null; return null; }
    const m = measureFace(face.keypoints), o = this.o;
    if (!this.cal) {
      this.frames.push(m);
      if (this.frames.length < o.calFrames) return null;
      this.cal = { ratio: median(this.frames.map(f => f.ratio)), open: median(this.frames.map(f => f.open)), eye: median(this.frames.map(f => f.eye)) };
      return 'calibrated';
    }
    this.warmth = clamp((m.ratio / this.cal.ratio - 1.04) / 0.14);
    this.spicy = Math.min(clamp((m.open - this.cal.open) / o.open), clamp((1 - m.eye / this.cal.eye) / o.squint));
    if (this.warmth > 0.5) this.spicy *= 0.3;
    return this.decide(now);
  }
  // Keyboard/mouse mode sets warmth/spicy directly, then calls this
  decide(now = performance.now()) {
    const o = this.o;
    if (now < this.until) return null;
    this.warmSince = this.warmth > o.warm ? this.warmSince ?? now : null;
    this.spicySince = this.spicy > 0.99 ? this.spicySince ?? now : null;
    if (this.spicySince !== null && now - this.spicySince > o.spicyHold) { this.until = now + o.cooldown; this.spicySince = null; return 'too-spicy'; }
    if (this.warmSince !== null && now - this.warmSince > o.warmHold) { this.until = now + o.cooldown; this.warmSince = null; return 'right'; }
    return null;
  }
}
