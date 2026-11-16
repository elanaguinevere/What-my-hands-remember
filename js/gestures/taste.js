// Tasting face (from experiments/e6-taste-facemesh, v3 — 16 Nov).
// 40 neutral frames → baseline (median). Every feature is then measured as a change from that baseline:
//   smile ("right")   = mouth wider than +15%  AND corners up more than +1.5 (% of face height), held 1.2 s (v3.1)
//   too spicy         = eyes scrunched > 22%   AND brows pulled down > 4%, held 0.6 s, not while smiling
// Why v3: the concept's "mouth open + eyes scrunched" didn't match a real reaction. Camera profiles (16 Nov):
//   smile → width +38.6%, corners +4.0, brows +2.8%, eyes +44%
//   spicy → width +4–7%,  corners ≈ 0,  brows −5.6 to −7.8%, eyes +35–38%, mouth stays closed
// The eyes scrunch in both, so they only count together with the brows.
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = v => Math.min(1, Math.max(0, v));
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

export function measureFace(k) {
  const faceW = d(k[234], k[454]), faceH = d(k[10], k[152]);
  return {
    width: d(k[61], k[291]) / faceW,                                                  // mouth width
    lift: ((k[13].y + k[14].y) / 2 - (k[61].y + k[291].y) / 2) / faceH,               // corners above the middle of the lips
    brow: (d(k[105], k[159]) + d(k[334], k[386])) / 2 / faceH,                         // eyebrow → upper eyelid
    open: d(k[13], k[14]) / faceH,                                                     // gap between the lips
    eye: (d(k[159], k[145]) / d(k[33], k[133]) + d(k[386], k[374]) / d(k[362], k[263])) / 2   // eye height ÷ width
  };
}

export class TasteDetector {
  constructor(opts = {}) {
    this.o = { calFrames: 40, smileWidth: 15, smileLift: 1.5, warmHold: 1200, spicyEyes: 22, spicyBrow: 4, spicyHold: 600, cooldown: 3000, ...opts };
    this.recalibrate();
  }
  recalibrate() { this.cal = null; this.frames = []; this.warmth = 0; this.spicy = 0; this.warmSince = null; this.spicySince = null; this.until = 0; this.rearmed = true; }
  get calibrated() { return !!this.cal; }
  get progress() { return this.cal ? 1 : this.frames.length / this.o.calFrames; }

  // Returns 'calibrated' | 'right' | 'too-spicy' | null
  update(face, now = performance.now()) {
    if (!face) { this.warmSince = this.spicySince = null; return null; }
    const m = measureFace(face.keypoints), o = this.o;
    if (!this.cal) {
      this.frames.push(m);
      if (this.frames.length < o.calFrames) return null;
      this.cal = {};
      for (const key of Object.keys(m)) this.cal[key] = median(this.frames.map(f => f[key]));
      return 'calibrated';
    }
    const c = this.cal;
    const width = (m.width / c.width - 1) * 100, lift = (m.lift - c.lift) * 100;
    const brow = (m.brow / c.brow - 1) * 100, eyes = (1 - m.eye / c.eye) * 100;
    this.warmth = Math.min(clamp(width / o.smileWidth), clamp(lift / o.smileLift));
    this.spicy = Math.min(clamp(eyes / o.spicyEyes), clamp(-brow / o.spicyBrow));
    if (this.warmth > 0.5) this.spicy *= 0.3;            // eyes also scrunch in a smile
    return this.decide(now);
  }
  // Keyboard/mouse mode sets warmth/spicy directly, then calls this
  decide(now = performance.now()) {
    const o = this.o;
    // After an event the face must relax before the next one (a long smile counted again every 3 s in v1)
    if (!this.rearmed && this.warmth < 0.5 && this.spicy < 0.3) this.rearmed = true;
    if (now < this.until || !this.rearmed) return null;
    // Start at full strength, keep going while above 0.7 (v3.1: a smile flickers around the threshold)
    this.warmSince = this.warmSince !== null ? (this.warmth > 0.7 ? this.warmSince : null) : (this.warmth > 0.99 ? now : null);
    this.spicySince = this.spicySince !== null ? (this.spicy > 0.7 ? this.spicySince : null) : (this.spicy > 0.99 ? now : null);
    if (this.spicySince !== null && now - this.spicySince > o.spicyHold) { this.until = now + o.cooldown; this.spicySince = null; this.rearmed = false; return 'too-spicy'; }
    if (this.warmSince !== null && now - this.warmSince > o.warmHold) { this.until = now + o.cooldown; this.warmSince = null; this.rearmed = false; return 'right'; }
    return null;
  }
}
