"use strict";

(function (root) {
  const WIDTH = 1200;
  const HEIGHT = 680;
  const RATE = 60;
  const DURATION = 150;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const neutralInput = () => ({ x: 0, y: 0, brake: false, interact: false, target: null });

  function navigationObstacles(buoys) {
    return buoys.map(buoy => ({
      left: buoy.baseX - buoy.radius - 79,
      right: buoy.baseX + buoy.radius + 79,
      top: buoy.baseY - buoy.radius - 35,
      bottom: buoy.baseY + buoy.radius + 35
    }));
  }

  function inside(point, obstacle) {
    return point.x > obstacle.left && point.x < obstacle.right && point.y > obstacle.top && point.y < obstacle.bottom;
  }

  function clearSegment(a, b, obstacles) {
    return obstacles.every(obstacle => {
      let entry = 0;
      let exit = 1;
      for (const [origin, delta, low, high] of [[a.x, b.x - a.x, obstacle.left, obstacle.right], [a.y, b.y - a.y, obstacle.top, obstacle.bottom]]) {
        if (Math.abs(delta) < 1e-9) {
          if (origin <= low || origin >= high) return true;
        } else {
          const first = (low - origin) / delta;
          const last = (high - origin) / delta;
          entry = Math.max(entry, Math.min(first, last));
          exit = Math.min(exit, Math.max(first, last));
          if (entry >= exit) return true;
        }
      }
      return entry >= exit;
    });
  }

  function safeDestination(point, obstacles) {
    let result = { x: clamp(point.x, 72, WIDTH - 72), y: clamp(point.y, 444, HEIGHT - 38) };
    for (const obstacle of obstacles) {
      if (!inside(result, obstacle)) continue;
      const choices = [
        { x: obstacle.left - 3, y: result.y },
        { x: obstacle.right + 3, y: result.y },
        { x: result.x, y: obstacle.top - 3 },
        { x: result.x, y: obstacle.bottom + 3 }
      ].filter(candidate => candidate.x >= 72 && candidate.x <= WIDTH - 72 && candidate.y >= 444 && candidate.y <= HEIGHT - 38 && !obstacles.some(other => inside(candidate, other)));
      choices.sort((a, b) => Math.hypot(a.x - result.x, a.y - result.y) - Math.hypot(b.x - result.x, b.y - result.y));
      if (choices.length) result = choices[0];
    }
    return result;
  }

  function planRoute(start, destination, obstacles) {
    const safeStart = safeDestination(start, obstacles);
    const target = safeDestination(destination, obstacles);
    const points = [safeStart, target];
    for (const obstacle of obstacles) {
      for (const x of [obstacle.left - 3, obstacle.right + 3]) {
        for (const y of [obstacle.top - 3, obstacle.bottom + 3]) {
          if (x >= 72 && x <= WIDTH - 72 && y >= 444 && y <= HEIGHT - 38 && !obstacles.some(other => inside({ x, y }, other))) points.push({ x, y });
        }
      }
    }
    const costs = points.map(() => Infinity);
    const parents = points.map(() => -1);
    const visited = new Set();
    costs[0] = 0;
    for (let step = 0; step < points.length; step++) {
      let current = -1;
      for (let i = 0; i < points.length; i++) if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
      if (current < 0 || !Number.isFinite(costs[current])) break;
      if (current === 1) break;
      visited.add(current);
      for (let next = 0; next < points.length; next++) {
        if (visited.has(next) || !clearSegment(points[current], points[next], obstacles)) continue;
        const cost = costs[current] + Math.hypot(points[current].x - points[next].x, points[current].y - points[next].y);
        if (cost < costs[next]) { costs[next] = cost; parents[next] = current; }
      }
    }
    if (!Number.isFinite(costs[1])) return [];
    const route = [];
    for (let current = 1; current > 0; current = parents[current]) route.unshift(points[current]);
    if (Math.hypot(start.x - safeStart.x, start.y - safeStart.y) > 1) route.unshift(safeStart);
    return route;
  }

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
      this.message = "Go to a gold crate and press E to pick it up.";
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
      this.navigation = null;
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
      if (this.status === "won") return "All three crates delivered!";
      if (this.status === "lost") return this.boat.health <= 0 ? "Your boat is too damaged. Press Restart to try again." : "Time is up. Press Restart to try again.";
      if (this.messageTicks > 0) return this.message;
      if (this.boat.cargo !== null) {
        if (Math.hypot(this.boat.x - this.dock.x, this.boat.y - this.dock.y) < this.dock.radius) return "Hold Space to brake, then press E to deliver.";
        return "Bring the crate to the green circle on the left.";
      }
      const next = this.cargo.find(cargo => cargo.state === "waiting");
      return next ? "Pick up a gold crate with E. Avoid the red buoys." : "All crates delivered.";
    }

    interact() {
      const boat = this.boat;
      if (boat.cargo !== null) {
        if (Math.hypot(boat.x - this.dock.x, boat.y - this.dock.y) > this.dock.radius) {
          this.notify("Go back to the green circle to unload.");
        } else if (Math.hypot(boat.vx, boat.vy) > 45) {
          this.notify("Too fast to dock. Hold Space to brake.");
        } else {
          this.cargo.find(cargo => cargo.id === boat.cargo).state = "delivered";
          boat.cargo = null;
          this.delivered += 1;
          this.score += 1000;
          this.notify("Delivered! " + this.delivered + " of 3 crates done.");
          if (this.delivered === 3) {
            this.status = "won";
            this.score += Math.floor(this.remaining) * 10 + boat.health * 5;
          }
        }
        return;
      }
      let closest = null;
      let distance = 64;
      for (const cargo of this.cargo) {
        const current = Math.hypot(boat.x - cargo.x, boat.y - cargo.y);
        if (cargo.state === "waiting" && current < distance) {
          closest = cargo;
          distance = current;
        }
      }
      if (closest) {
        closest.state = "aboard";
        boat.cargo = closest.id;
        this.notify("Crate " + closest.id + " picked up. Take it back to the dock.");
      } else {
        this.notify("Move closer to a gold crate first.");
      }
    }

    update(dt, input = neutralInput()) {
      if (this.status !== "playing") return;
      this.previous = this.captureVisual();
      this.tick += 1;
      this.time = this.tick / RATE;
      this.remaining = Math.max(0, DURATION - this.time);
      this.messageTicks = Math.max(0, this.messageTicks - 1);
      const boat = this.boat;
      let axisX = clamp(Number(input.x) || 0, -1, 1);
      let axisY = clamp(Number(input.y) || 0, -1, 1);
      const manual = axisX !== 0 || axisY !== 0;
      let navigationBrake = false;
      if (manual || input.brake || !input.target) this.navigation = null;
      if (!manual && !input.brake && input.target) {
        if (!this.navigation || this.navigation.request.x !== input.target.x || this.navigation.request.y !== input.target.y) {
          this.navigation = { request: { ...input.target }, route: planRoute(boat, input.target, navigationObstacles(this.buoys)), index: 0, blocked: false };
        }
        const navigation = this.navigation;
        let waypoint = navigation.route[navigation.index];
        if (waypoint && Math.hypot(waypoint.x - boat.x, waypoint.y - boat.y) < 5 && Math.hypot(boat.vx, boat.vy) < 18 && navigation.index < navigation.route.length - 1) waypoint = navigation.route[++navigation.index];
        if (waypoint && !navigation.blocked) {
          const dx = waypoint.x - boat.x;
          const dy = waypoint.y - boat.y;
          const distance = Math.hypot(dx, dy);
          const speed = Math.min(125, distance * 2.5);
          const desiredX = distance > 0.01 ? dx / distance * speed : 0;
          const desiredY = distance > 0.01 ? dy / distance * speed : 0;
          const acceleration = boat.cargo === null ? 235 : 205;
          axisX = clamp((desiredX - boat.vx) * 0.06 + desiredX * 1.05 / acceleration, -1, 1);
          axisY = clamp((desiredY - boat.vy) * 0.06 + desiredY * 1.05 / acceleration, -1, 1);
        } else navigationBrake = true;
      }
      const length = Math.hypot(axisX, axisY);
      if (length > 1) {
        axisX /= length;
        axisY /= length;
      }
      const acceleration = boat.cargo === null ? 235 : 205;
      const drag = input.brake || navigationBrake ? 7.5 : 1.05;
      boat.vx = (boat.vx + axisX * acceleration * dt) * Math.exp(-drag * dt);
      boat.vy = (boat.vy + axisY * acceleration * dt) * Math.exp(-drag * dt);
      const speed = Math.hypot(boat.vx, boat.vy);
      const maxSpeed = boat.cargo === null ? 205 : 172;
      if (speed > maxSpeed) {
        boat.vx *= maxSpeed / speed;
        boat.vy *= maxSpeed / speed;
      }
      boat.x += boat.vx * dt;
      boat.y += boat.vy * dt;
      if (boat.x < 72 || boat.x > WIDTH - 72) {
        boat.x = clamp(boat.x, 72, WIDTH - 72);
        boat.vx = 0;
      }
      if (boat.y < 444 || boat.y > HEIGHT - 38) {
        boat.y = clamp(boat.y, 444, HEIGHT - 38);
        boat.vy = 0;
      }
      if (Math.abs(boat.vx) > 12) boat.heading = boat.vx > 0 ? 1 : -1;
      boat.wheelAngle += Math.hypot(boat.vx, boat.vy) * dt / 13;
      boat.flagPhase += dt * 5.2;
      boat.invulnerable = Math.max(0, boat.invulnerable - dt);
      this.lighthouse.beamAngle += dt * 0.42;
      this.crane.boomAngle = -0.48 + Math.sin(this.time * 0.55) * 0.2;
      this.crane.hookSwing = Math.sin(this.time * 1.7) * 0.16;
      this.crane.cableLength = 80 + Math.sin(this.time * 0.9) * 16;
      for (const turbine of this.turbines) turbine.bladeAngle += turbine.speed * dt;
      for (const buoy of this.buoys) {
        buoy.x = buoy.baseX + Math.sin(this.time * 0.55 + buoy.phase) * 24;
        buoy.y = buoy.baseY + Math.sin(this.time * 0.8 + buoy.phase) * 8;
        const dx = boat.x - buoy.x;
        const dy = boat.y - buoy.y;
        const rx = 43 + buoy.radius;
        const ry = 15 + buoy.radius;
        const distance = Math.hypot(dx / rx, dy / ry);
        if (distance < 1) {
          if (this.navigation) this.navigation.blocked = true;
          const normalX = distance > 0.001 ? dx / rx / distance : 1;
          const normalY = distance > 0.001 ? dy / ry / distance : 0;
          boat.x = buoy.x + normalX * (rx + 1);
          boat.y = buoy.y + normalY * (ry + 1);
          boat.vx = normalX * 45;
          boat.vy = normalY * 45;
          if (boat.invulnerable === 0) {
            boat.health = Math.max(0, boat.health - 16);
            boat.invulnerable = 1.5;
            this.collisions += 1;
            this.notify("You hit a buoy. Watch your hull!");
          }
        }
      }
      boat.x = clamp(boat.x, 72, WIDTH - 72);
      boat.y = clamp(boat.y, 444, HEIGHT - 38);
      for (const puff of this.smoke) {
        puff.px = puff.x;
        puff.py = puff.y;
        puff.x += puff.vx * dt;
        puff.y += puff.vy * dt;
        puff.life -= dt;
        puff.size += 3.8 * dt;
      }
      this.smoke = this.smoke.filter(puff => puff.life > 0);
      if (this.tick % 9 === 0) {
        const x = boat.x + boat.heading * 20;
        const y = boat.y - 44;
        this.smoke.push({ x, y, px: x, py: y, vx: -12 + this.random() * 8, vy: -24 - this.random() * 9, life: 1.8, size: 3 + this.random() * 3 });
      }
      for (const wake of this.wake) wake.life -= dt;
      this.wake = this.wake.filter(wake => wake.life > 0);
      if (this.tick % 5 === 0 && Math.hypot(boat.vx, boat.vy) > 18) {
        this.wake.push({ x: boat.x - boat.heading * 45, y: boat.y + 12, life: 1.2 });
      }
      if (boat.health <= 0 || this.remaining <= 0) this.status = "lost";
      else if (input.interact) this.interact();
    }

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
