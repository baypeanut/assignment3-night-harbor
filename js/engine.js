"use strict";

(function (root) {
  class FixedStepEngine {
    constructor(update, rate = 60, maxSteps = 120) {
      this.update = update;
      this.stepMs = 1000 / rate;
      this.dt = 1 / rate;
      this.maxSteps = maxSteps;
      this.reset();
    }

    reset() {
      this.accumulator = 0;
      this.lastTime = null;
      this.ticks = 0;
      this.lastSteps = 0;
    }

    synchronize(timestamp) {
      this.lastTime = timestamp;
      this.accumulator = 0;
      this.lastSteps = 0;
    }

    advance(timestamp) {
      if (!Number.isFinite(timestamp)) return 0;
      if (this.lastTime === null) {
        this.lastTime = timestamp;
        return 0;
      }
      const elapsed = Math.max(0, timestamp - this.lastTime);
      this.lastTime = Math.max(this.lastTime, timestamp);
      this.accumulator += elapsed;
      this.lastSteps = 0;
      while (this.accumulator + 1e-7 >= this.stepMs && this.lastSteps < this.maxSteps) {
        if (this.update(this.dt, this.ticks) === false) {
          this.accumulator = 0;
          break;
        }
        this.accumulator = Math.max(0, this.accumulator - this.stepMs);
        this.ticks += 1;
        this.lastSteps += 1;
      }
      return Math.min(1, this.accumulator / this.stepMs);
    }
  }

  if (typeof module !== "undefined" && module.exports) module.exports = FixedStepEngine;
  root.FixedStepEngine = FixedStepEngine;
})(globalThis);
