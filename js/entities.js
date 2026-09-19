"use strict";

class HarborRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.background = document.createElement("canvas");
    this.background.width = 1200;
    this.background.height = 680;
    this.createBackground();
  }

  createBackground() {
    const c = this.background.getContext("2d");
    const sky = c.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, "#0a1a29");
    sky.addColorStop(1, "#203d47");
    c.fillStyle = sky;
    c.fillRect(0, 0, 1200, 680);
    for (let i = 0; i < 100; i++) {
      c.fillStyle = "rgba(238,232,209," + (0.2 + (i % 5) * 0.12) + ")";
      c.beginPath();
      c.arc((i * 137 + 37) % 1200, (i * 79 + 21) % 295, i % 7 === 0 ? 1.6 : 0.9, 0, Math.PI * 2);
      c.fill();
    }
    const halo = c.createRadialGradient(915, 100, 5, 915, 100, 110);
    halo.addColorStop(0, "#ead9a622");
    halo.addColorStop(1, "#ead9a600");
    c.fillStyle = halo;
    c.fillRect(805, 0, 220, 210);
    c.fillStyle = "#e8dfbc";
    c.beginPath(); c.arc(915, 100, 24, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#142c37";
    c.beginPath(); c.moveTo(0, 376);
    for (let x = 0; x <= 1200; x += 60) c.lineTo(x, 371 + Math.sin(x * 0.012) * 21);
    c.lineTo(1200, 440); c.lineTo(0, 440); c.fill();
    const water = c.createLinearGradient(0, 412, 0, 680);
    water.addColorStop(0, "#225264"); water.addColorStop(1, "#0d2837");
    c.fillStyle = water; c.fillRect(0, 412, 1200, 268);
    c.fillStyle = "#3a4240"; c.fillRect(0, 392, 265, 15); c.fillRect(977, 398, 223, 14);
    c.fillStyle = "#263734";
    for (let x = 20; x < 265; x += 45) c.fillRect(x, 407, 9, 36);
    for (let x = 995; x < 1200; x += 45) c.fillRect(x, 412, 9, 29);
    c.fillStyle = "#b9bea7"; c.font = "10px monospace";
    c.fillText("DOCK", 20, 382);
    c.fillText("LOADING AREA", 1024, 389);
  }

  circle(x, y, radius, color) {
    const c = this.ctx;
    c.fillStyle = color; c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
  }

  lighthouse(light) {
    const c = this.ctx;
    c.save(); c.translate(light.x, light.y);
    c.fillStyle = "#253640"; c.fillRect(-18, -139, 36, 139);
    c.fillStyle = "#d1d6ca";
    for (let i = 0; i < 6; i++) c.fillRect(-18, -130 + i * 23, 36, 10);
    c.fillStyle = "#d9b565"; c.beginPath(); c.moveTo(-25, -139); c.lineTo(0, -165); c.lineTo(25, -139); c.fill();
    c.save(); c.translate(0, -127); c.rotate(light.beamAngle);
    const beam = c.createLinearGradient(0, 0, 310, 0);
    beam.addColorStop(0, "#ffe9aa69"); beam.addColorStop(1, "#ffe9aa00");
    c.fillStyle = beam; c.beginPath(); c.moveTo(0, 0); c.lineTo(310, -65); c.lineTo(310, 65); c.fill();
    c.restore(); this.circle(0, -127, 9, "#fae8a7"); c.restore();
  }

  turbine(turbine) {
    const c = this.ctx;
    c.save(); c.translate(turbine.x, turbine.y); c.scale(turbine.scale, turbine.scale);
    c.fillStyle = "#859da4"; c.fillRect(-5, -132, 10, 132);
    c.save(); c.translate(0, -132); c.rotate(turbine.bladeAngle); c.fillStyle = "#d1e0dd";
    for (let i = 0; i < 3; i++) {
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -24, 4, -73); c.quadraticCurveTo(-3, -25, 0, 0); c.fill(); c.rotate(Math.PI * 2 / 3);
    }
    this.circle(0, 0, 7, "#d9b565"); c.restore(); c.restore();
  }

  crane(crane) {
    const c = this.ctx;
    c.save(); c.translate(crane.x, crane.y); c.scale(-1, 1);
    c.fillStyle = "#596871"; c.fillRect(-12, -111, 24, 111); c.fillRect(-40, -9, 80, 13);
    c.save(); c.translate(0, -111); c.rotate(crane.boomAngle);
    c.fillStyle = "#c3a45b"; c.fillRect(-30, -13, 175, 14);
    c.strokeStyle = "#857647"; c.lineWidth = 2;
    for (let x = -20; x < 140; x += 20) { c.beginPath(); c.moveTo(x, -13); c.lineTo(x + 10, 1); c.lineTo(x + 20, -13); c.stroke(); }
    c.save(); c.translate(138, 0); c.rotate(crane.hookSwing - crane.boomAngle);
    c.strokeStyle = "#c8d2cc"; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, crane.cableLength); c.stroke();
    c.strokeStyle = "#dc9170"; c.lineWidth = 4; c.beginPath(); c.arc(0, crane.cableLength + 5, 7, -Math.PI / 2, Math.PI); c.stroke();
    c.restore(); c.restore(); c.restore();
  }

  wheel(x, angle) {
    const c = this.ctx;
    c.save(); c.translate(x, 10); c.rotate(angle);
    this.circle(0, 0, 16, "#122b37");
    c.strokeStyle = "#a4b9bb"; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.moveTo(-14, 0); c.lineTo(14, 0); c.moveTo(0, -14); c.lineTo(0, 14); c.stroke(); c.restore();
  }

  boat(boat, time) {
    const c = this.ctx;
    c.save(); c.translate(boat.x, boat.y); c.scale(boat.heading * 0.82, 0.82); c.rotate(Math.sin(time * 2.3) * 0.018);
    if (boat.invulnerable > 0 && Math.floor(time * 10) % 2 === 0) c.globalAlpha = 0.55;
    c.fillStyle = "#c87543"; c.beginPath(); c.moveTo(-70, 0); c.lineTo(70, 0); c.lineTo(54, 28); c.lineTo(-52, 28); c.closePath(); c.fill();
    c.fillStyle = "#efc786"; c.fillRect(-67, -3, 133, 5);
    c.fillStyle = "#e9d6af"; c.fillRect(-20, -28, 48, 28);
    c.fillStyle = "#182f3c"; c.fillRect(-16, -24, 17, 15); c.fillRect(7, -24, 17, 15);
    c.fillStyle = "#354b56"; c.fillRect(-24, -33, 57, 6); c.fillRect(18, -52, 14, 23);
    c.fillStyle = "#d39f5b"; c.fillRect(17, -54, 16, 6);
    this.wheel(-34, boat.wheelAngle); this.wheel(34, boat.wheelAngle);
    c.save(); c.translate(-8, -33); c.strokeStyle = "#bfcdca"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -40); c.stroke();
    c.translate(0, -40); c.fillStyle = "#d87562"; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(16 + Math.sin(boat.flagPhase) * 5, 7, 30, 3); c.quadraticCurveTo(17, 20, 0, 13); c.fill(); c.restore();
    if (boat.cargo !== null) this.crate(-48, -16, 0.75);
    c.restore();
  }

  crate(x, y, scale = 1) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.scale(scale, scale);
    c.fillStyle = "#b68f4a"; c.fillRect(-14, -15, 28, 26);
    c.strokeStyle = "#e7c980"; c.lineWidth = 2; c.strokeRect(-14, -15, 28, 26);
    c.beginPath(); c.moveTo(-12, -13); c.lineTo(12, 9); c.moveTo(12, -13); c.lineTo(-12, 9); c.stroke(); c.restore();
  }

  draw(model, alpha, target = null) {
    const c = this.ctx;
    const view = model.visual(alpha);
    const time = view.time;
    c.drawImage(this.background, 0, 0);
    c.save(); c.strokeStyle = "#a2c9d01b"; c.lineWidth = 1;
    for (let row = 0; row < 12; row++) {
      c.beginPath();
      for (let x = 0; x <= 1200; x += 20) { const y = 433 + row * 19 + Math.sin(x * 0.025 + time * 1.8 + row) * 3; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
    }
    c.restore();
    this.lighthouse(view.lighthouse);
    for (const turbine of view.turbines) this.turbine(turbine);
    this.crane(view.crane);
    c.save(); c.strokeStyle = "#8fd2b7"; c.fillStyle = "#8fd2b70b"; c.lineWidth = 1.5; c.setLineDash([7, 7]);
    c.beginPath(); c.ellipse(model.dock.x, model.dock.y, 73, 34, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.setLineDash([]);
    c.fillStyle = "#acdbc5"; c.font = "10px monospace"; c.textAlign = "center"; c.fillText("DELIVER HERE [E]", model.dock.x, model.dock.y + 51); c.restore();
    for (const cargo of model.cargo) {
      if (cargo.state !== "waiting") continue;
      const y = cargo.y + Math.sin(time * 2 + cargo.id) * 3;
      c.save(); c.strokeStyle = "#dbb96f88"; c.setLineDash([3, 5]); c.beginPath(); c.ellipse(cargo.x, cargo.y + 5, 31, 15, 0, 0, Math.PI * 2); c.stroke(); c.restore();
      this.crate(cargo.x, y);
      c.fillStyle = "#efd599"; c.font = "10px monospace"; c.textAlign = "center"; c.fillText("0" + cargo.id + " / CARGO", cargo.x, y - 27);
    }
    for (const buoy of view.buoys) {
      c.save(); c.translate(buoy.x, buoy.y); c.rotate(Math.sin(time * 2 + buoy.phase) * 0.09);
      c.fillStyle = "#263e46"; c.beginPath(); c.ellipse(0, 9, 20, 7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#c57661"; c.beginPath(); c.moveTo(-10, 5); c.lineTo(-5, -22); c.lineTo(5, -22); c.lineTo(10, 5); c.fill();
      c.fillStyle = "#e1d3b3"; c.fillRect(-8, -4, 16, 5);
      this.circle(0, -24, 4, Math.sin(time * 3 + buoy.phase) > 0 ? "#ffe0a0" : "#bc7161"); c.restore();
    }
    for (const wake of model.wake) {
      c.strokeStyle = "rgba(175,215,214," + wake.life * 0.12 + ")"; c.beginPath(); c.ellipse(wake.x, wake.y, 14 + (1.2 - wake.life) * 20, 3 + (1.2 - wake.life) * 6, 0, 0, Math.PI * 2); c.stroke();
    }
    for (const puff of model.smoke) { c.save(); c.globalAlpha = Math.max(0, puff.life / 1.8) * 0.3; this.circle(Harbor.lerp(puff.px, puff.x, alpha), Harbor.lerp(puff.py, puff.y, alpha), puff.size, "#c0ced0"); c.restore(); }
    this.boat(view.boat, time);
    if (target && model.navigation && !model.navigation.blocked) {
      const route = model.navigation.route.slice(model.navigation.index);
      c.save(); c.strokeStyle = "#b7d9ce66"; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(view.boat.x, view.boat.y);
      for (const point of route) c.lineTo(point.x, point.y);
      c.stroke();
      const destination = route[route.length - 1];
      if (destination) { c.beginPath(); c.arc(destination.x, destination.y, 14, 0, Math.PI * 2); c.stroke(); }
      c.restore();
    }
    c.textAlign = "left";
  }
}
