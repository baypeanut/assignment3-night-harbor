"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function runtime() {
  const ids = [...fs.readFileSync(path.join(__dirname, "../index.html"), "utf8").matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  const elements = new Map();
  const events = new Map();
  const queue = [];
  const logs = [];
  const renders = [];
  let now = 0;
  for (const id of ids) elements.set(id, {
    id, checked: id === "interpolation", value: "0", textContent: "", disabled: false, hidden: false, open: false,
    events: new Map(), style: {},
    addEventListener(name, listener) { this.events.set(name, listener); },
    focus() {},
    matches() { return false; },
    showModal() { this.open = true; },
    close() { this.open = false; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 680 }; }
  });
  const document = {
    hidden: false,
    getElementById(id) { assert.ok(elements.has(id), "Missing element: " + id); return elements.get(id); },
    querySelectorAll() { return []; },
    addEventListener(name, listener) { events.set(name, listener); }
  };
  const context = vm.createContext({
    document,
    window: { addEventListener(name, listener) { events.set(name, listener); } },
    performance: { now: () => now },
    requestAnimationFrame: callback => { queue.push(callback); return queue.length; },
    setTimeout: callback => callback(),
    console: { log: message => logs.push(message), info: message => logs.push(message), table: value => logs.push(value) },
    HarborRenderer: class { draw(model, alpha) { renders.push({ timestamp: now, snapshot: model.snapshot(), tick: model.tick, x: model.boat.x, alpha }); } }
  });
  for (const file of ["engine.js", "model.js", "verification.js", "main.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", file), "utf8"), context, { filename: file });
  function frame(timestamp) { now = timestamp; assert.equal(queue.length, 1); queue.shift()(timestamp); }
  function fire(id, name, extra = {}) {
    const target = elements.get(id);
    const listener = target.events.get(name);
    assert.ok(listener, id + " missing " + name);
    listener({ target, ...extra });
  }
  function key(name, code) { events.get(name)({ target: elements.get("scene"), code, repeat: false, preventDefault() {} }); }
  return { elements, events, frame, fire, key, renders, logs };
}

for (const rate of [60, 144]) {
  const app = runtime();
  app.elements.get("fps-limit").value = "15";
  app.fire("fps-limit", "change");
  app.fire("start", "click");
  app.frame(0);
  for (let i = 1; i <= rate * 10; i++) app.frame(i * 1000 / rate);
  const last = app.renders.at(-1);
  assert.equal(last.tick, 600, "Physics must run at 60 updates per second");
  assert.ok(app.renders.length >= 150 && app.renders.length <= 152, "Expected 150 render frames plus initial frame, got " + app.renders.length);
  console.log("PASS: 15 FPS render cap at " + rate + " Hz; " + app.renders.length + " frames, " + last.tick + " ticks.");
}

const app = runtime();
app.elements.get("console-trace").checked = true;
app.fire("console-trace", "change");
app.fire("start", "click");
app.frame(0);
app.key("keydown", "KeyD");
for (let i = 1; i <= 60; i++) app.frame(i * 1000 / 60);
assert.ok(app.renders.at(-1).x > 200);
app.key("keyup", "KeyD");
const recorded = app.renders.at(-1).snapshot;
app.fire("settings-open", "click");
assert.equal(app.elements.get("settings").open, true);
app.fire("replay", "click");
assert.equal(app.elements.get("settings").open, false);
app.frame(1100);
for (let i = 1; i <= 60; i++) app.frame(1100 + i * 1000 / 60);
assert.equal(app.renders.at(-1).snapshot, recorded, "Replay must reproduce the full recorded state");
app.frame(1100 + 61 * 1000 / 60);
assert.equal(app.elements.get("overlay-title").textContent, "Replay finished");
app.fire("start", "click");
app.frame(2200);
app.events.get("blur")();
app.frame(3000);
const paused = app.renders.at(-1).snapshot;
app.frame(8000);
assert.equal(app.renders.at(-1).snapshot, paused);
app.fire("start", "click");
app.frame(8017);
assert.ok(app.renders.at(-1).tick < 70, "Pause time must not advance the simulation");
app.fire("restart", "click");
app.frame(9000);
assert.equal(app.renders.at(-1).tick, 0);
for (let i = 1; i <= 180; i++) app.frame(9000 + i * 1000 / 60);
assert.ok(app.logs.filter(line => typeof line === "string" && line.startsWith("tick: ")).length >= 120);
app.fire("verify", "click");
assert.match(app.elements.get("verification-result").textContent, /^Passed/);
assert.equal(app.elements.get("verify").disabled, false);
console.log("PASS: keyboard input, settings, actual recorded replay, blur pause, resume, restart, console trace and timing button.");
