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
    c.fillText("WEST BERTH / DELIVERIES", 20, 382);
    c.fillText("EAST LOADING DOCK", 1024, 389);
  }

  circle(x, y, radius, color) {
    const c = this.ctx;
    c.fillStyle = color; c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
  }

  draw(model, alpha) {
    this.ctx.drawImage(this.background, 0, 0);
  }
}
