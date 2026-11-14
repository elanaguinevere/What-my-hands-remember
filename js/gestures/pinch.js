// One pinch = one spice (ported from experiments/e5-pinch-classifier).
// Fires when pinch confidence ≥ minConf for `inARow` results, then waits until another
// shape is clearly shown (≥ rearm) before the next pinch can count.
export class PinchCounter {
  constructor(opts = {}) {
    this.o = { minConf: 0.75, inARow: 3, rearm: 0.6, ...opts };
    this.reset();
  }
  reset() { this.armed = true; this.streak = 0; this.count = 0; }
  // conf = { open, fist, pinch } → returns true when a pinch was counted
  update(conf) {
    const o = this.o;
    const top = Object.keys(conf).reduce((a, b) => (conf[a] >= conf[b] ? a : b));
    if (this.armed) {
      this.streak = conf.pinch >= o.minConf ? this.streak + 1 : 0;
      if (this.streak >= o.inARow) { this.armed = false; this.streak = 0; this.count += 1; return true; }
    } else if (top !== 'pinch' && conf[top] >= o.rearm) this.armed = true;
    return false;
  }
}
