"use strict";

(function (root) {
  const H = typeof module !== "undefined" && module.exports ? require("./model.js") : root.Harbor;
  const Engine = typeof module !== "undefined" && module.exports ? require("./engine.js") : root.FixedStepEngine;

  function verificationInput(tick) {
    const phase = Math.floor(tick / 150) % 4;
    return { x: phase === 0 ? 1 : phase === 2 ? -1 : 0, y: phase === 1 ? 1 : phase === 3 ? -1 : 0, brake: tick % 150 > 125, interact: tick % 87 === 0, target: null };
  }

  function verifyTiming(tape = null) {
    const total = tape && tape.length ? tape.length : 1200;
    const reference = new H.HarborModel();
    const states = [];
    for (let tick = 0; tick < total; tick++) {
      reference.update(1 / 60, tape ? tape[tick] : verificationInput(tick));
      states.push(reference.snapshot());
    }
    const schedules = [{ name: "15 FPS", steps: [1000 / 15] }, { name: "30 FPS", steps: [1000 / 30] }, { name: "60 FPS", steps: [1000 / 60] }, { name: "144 FPS", steps: [1000 / 144] }, { name: "Irregular", steps: [7, 41, 12, 83, 16, 29, 5, 110] }];
    const results = schedules.map(schedule => {
      const model = new H.HarborModel();
      let count = 0;
      let mismatch = null;
      const engine = new Engine(dt => {
        if (count >= total) return false;
        model.update(dt, tape ? tape[count] : verificationInput(count));
        if (model.snapshot() !== states[count] && mismatch === null) mismatch = count + 1;
        count += 1;
        return true;
      });
      let timestamp = 0;
      let frames = 0;
      engine.advance(0);
      while (count < total && frames < total * 10) {
        timestamp += schedule.steps[frames % schedule.steps.length];
        engine.advance(timestamp);
        frames += 1;
      }
      return { schedule: schedule.name, ticks: count, passed: mismatch === null && count === total, mismatch };
    });
    return { passed: results.every(result => result.passed), ticks: total, results };
  }

  const api = { verifyTiming, verificationInput };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.HarborVerification = api;
})(globalThis);
