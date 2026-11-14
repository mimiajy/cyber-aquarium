/* Preserve elapsed time during ordinary frame drops. No species speed changes. */
(() => {
  'use strict';
  class FrameStepper {
    constructor() { this.dropped=0; this.simulated=0; this.steps=0; }
    advance(elapsed, update) {
      const raw=Number.isFinite(elapsed) ? Math.max(0,elapsed) : 0;
      const seconds=Math.min(raw,.25);
      this.dropped+=raw-seconds;
      this.steps=seconds>0 ? Math.max(1,Math.ceil(seconds*60-1e-5)) : 0;
      const dt=this.steps ? seconds/this.steps : 0;
      for(let i=0;i<this.steps;i++) update(dt);
      this.simulated+=seconds;
      return this.steps;
    }
  }
  globalThis.ReefTiming={ FrameStepper };
})();
