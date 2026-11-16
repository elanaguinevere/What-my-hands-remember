// One pinch = one spice (from experiments/1-ml5/e5-pinch-classifier, v2 — 16 Nov).
// Fires when pinch confidence ≥ minConf for `inARow` results. Then it waits until another shape is
// clearly shown (≥ rearm) for `rearmRow` results in a row before the next pinch can count, and two
// spices are at least `minGap` ms apart.
// v1 re-armed on a single result: while a pinch was held the network sometimes flickered to fist/open
// for one result, which counted the same pinch again (camera test: 9 spices for 3 pinches).
export class PinchCounter {
  constructor(opts = {}) {
    this.o = { minConf: 0.75, inARow: 3, rearm: 0.6, rearmRow: 3, minGap: 500, ...opts };
    this.reset();
  }
  reset() { this.armed = true; this.streak = 0; this.armStreak = 0; this.count = 0; this.lastAt = -1e9; }
  // conf = { open, fist, pinch } → returns true when a pinch was counted
  update(conf, now = performance.now()) {
    const o = this.o;
    const top = Object.keys(conf).reduce((a, b) => (conf[a] >= conf[b] ? a : b));
    if (this.armed) {
      this.streak = conf.pinch >= o.minConf ? this.streak + 1 : 0;
      if (this.streak >= o.inARow) {
        this.streak = 0;
        if (now - this.lastAt < o.minGap) return false;
        this.armed = false; this.armStreak = 0; this.count += 1; this.lastAt = now;
        return true;
      }
    } else {
      this.armStreak = top !== 'pinch' && conf[top] >= o.rearm ? this.armStreak + 1 : 0;
      if (this.armStreak >= o.rearmRow) { this.armed = true; this.armStreak = 0; }
    }
    return false;
  }
}
