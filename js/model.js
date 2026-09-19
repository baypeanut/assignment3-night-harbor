"use strict";

(function (root) {
  const WIDTH = 1200;
  const HEIGHT = 680;
  const RATE = 60;
  const DURATION = 150;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const neutralInput = () => ({ x: 0, y: 0, brake: false, interact: false, target: null });

  class HarborModel {
    constructor(seed = 202609) {
      this.seed = seed >>> 0;
      this.tick = 0;
      this.time = 0;
      this.status = "playing";
      this.remaining = DURATION;
      this.delivered = 0;
      this.score = 0;
      this.collisions = 0;
      this.message = "Find the gold cargo marker. Press E nearby to collect.";
      this.messageTicks = 240;
      this.boat = { x: 190, y: 482, vx: 0, vy: 0, heading: 1, wheelAngle: 0, flagPhase: 0, health: 100, invulnerable: 0, cargo: null };
      this.dock = { x: 190, y: 482, radius: 72 };
      this.lighthouse = { x: 112, y: 389, beamAngle: -0.6 };
      this.crane = { x: 1064, y: 401, boomAngle: -0.44, hookSwing: 0, cableLength: 78 };
      this.turbines = [
        { x: 440, y: 391, scale: 0.7, bladeAngle: 0.3, speed: 1.8 },
        { x: 540, y: 391, scale: 0.9, bladeAngle: 1.2, speed: 2.2 },
        { x: 645, y: 391, scale: 0.65, bladeAngle: 2.4, speed: 2.6 }
      ];
      this.cargo = [
        { id: 1, x: 988, y: 478, state: "waiting", name: "Lantern supplies" },
        { id: 2, x: 746, y: 600, state: "waiting", name: "Turbine parts" },
        { id: 3, x: 450, y: 541, state: "waiting", name: "Medical stores" }
      ];
      this.buoys = [
        { x: 593, y: 473, baseX: 593, baseY: 473, phase: 0, radius: 17 },
        { x: 875, y: 568, baseX: 855, baseY: 568, phase: 1.3, radius: 18 },
        { x: 356, y: 595, baseX: 356, baseY: 595, phase: 2.8, radius: 16 }
      ];
      this.smoke = [];
      this.wake = [];
      this.previous = this.captureVisual();
    }

    random() {
      this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
      return this.seed / 4294967296;
    }

    captureVisual() {
      return {
        time: this.time,
        boat: { ...this.boat },
        lighthouse: { ...this.lighthouse },
        crane: { ...this.crane },
        turbines: this.turbines.map(turbine => ({ ...turbine })),
        buoys: this.buoys.map(buoy => ({ ...buoy }))
      };
    }

    notify(message) {
      this.message = message;
      this.messageTicks = 210;
    }

    prompt() {
      if (this.status === "won") return "All three shipments are home. The harbor is ready for dawn.";
      if (this.status === "lost") return this.boat.health <= 0 ? "The tug needs repairs. Start a new voyage to try again." : "The shift has ended. Start a new voyage to try again.";
      if (this.messageTicks > 0) return this.message;
      if (this.boat.cargo !== null) {
        if (Math.hypot(this.boat.x - this.dock.x, this.boat.y - this.dock.y) < this.dock.radius) return "Hold Space to brake, then press E to deliver.";
        return "Cargo aboard. Return to the green berth on the left.";
      }
      const next = this.cargo.find(cargo => cargo.state === "waiting");
      return next ? "Collect any gold cargo marker with E. Avoid the red channel buoys." : "All cargo is delivered.";
    }

    update() {}

    visual(alpha) {
      const blend = (previous, current, keys) => {
        const result = { ...current };
        for (const key of keys) result[key] = lerp(previous[key], current[key], alpha);
        return result;
      };
      return {
        time: lerp(this.previous.time, this.time, alpha),
        boat: blend(this.previous.boat, this.boat, ["x", "y", "wheelAngle", "flagPhase"]),
        lighthouse: blend(this.previous.lighthouse, this.lighthouse, ["beamAngle"]),
        crane: blend(this.previous.crane, this.crane, ["boomAngle", "hookSwing", "cableLength"]),
        turbines: this.turbines.map((turbine, index) => blend(this.previous.turbines[index], turbine, ["bladeAngle"])),
        buoys: this.buoys.map((buoy, index) => blend(this.previous.buoys[index], buoy, ["x", "y"]))
      };
    }

    snapshot() {
      const { previous, ...state } = this;
      return JSON.stringify(state);
    }
  }

  const api = { HarborModel, WIDTH, HEIGHT, RATE, DURATION, clamp, lerp, neutralInput };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Harbor = api;
})(globalThis);
