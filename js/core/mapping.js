// Signal → animation parameter (from experiment E8).
// normalise the input range → ease curve → output range → smoothed with gsap.quickTo
//
//   const steam = new Mapping({ inMin: .3, inMax: 1.5, curve: 'power2.out', target: '#steam', prop: 'opacity', smooth: .8 });
//   steam.update(stirSpeed);
//
// type is documentation only: 'direct' | 'continuous' | 'accumulate' | 'event' | 'state'
export class Mapping {
  constructor(options) {
    Object.assign(this, { inMin: 0, inMax: 1, outMin: 0, outMax: 1, curve: 'none', smooth: 0.2, type: 'continuous', value: 0, raw: 0 }, options);
    this.ease = window.gsap.parseEase(this.curve);
    this.setter = this.target && this.smooth > 0 ? window.gsap.quickTo(this.target, this.prop, { duration: this.smooth, ease: 'power2.out' }) : null;
  }
  update(input) {
    this.raw = input;
    const t = Math.min(1, Math.max(0, (input - this.inMin) / ((this.inMax - this.inMin) || 1)));
    const curved = this.ease(t);
    this.value = this.outMin + (this.outMax - this.outMin) * curved;
    if (this.apply) this.apply(this.value, curved);
    else if (this.setter) this.setter(this.value);
    else if (this.target) window.gsap.set(this.target, { [this.prop]: this.value });
    return this.value;
  }
}

// Event with hysteresis: fires once when value goes above `on`, re-arms below `off`
export function trigger({ on = 0.9, off = 0.3, fire }) {
  let armed = true;
  return value => {
    if (armed && value > on) { armed = false; fire(value); }
    else if (!armed && value < off) armed = true;
    return armed;
  };
}
