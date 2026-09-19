"use strict";

const assert = require("node:assert/strict");
const { HarborModel, neutralInput } = require("../js/model.js");
const Engine = require("../js/engine.js");
const { verifyTiming } = require("../js/verification.js");
const result = verifyTiming();
assert.equal(result.passed, true);
assert.equal(result.results.length, 5);
console.log(JSON.stringify(result, null, 2));
const model = new HarborModel();
for (let i = 0; i < 1200; i++) model.update(1 / 60, { ...neutralInput(), x: -1, y: -1 });
assert.ok(model.boat.x >= 72 && model.boat.y >= 444);
assert.ok(model.smoke.length <= 14);
const visualBefore = model.snapshot();
model.visual(0.4);
assert.equal(model.snapshot(), visualBefore);
const delivery = new HarborModel();
for (const cargo of delivery.cargo) {
  delivery.boat.x = cargo.x; delivery.boat.y = cargo.y;
  delivery.interact();
  assert.equal(delivery.boat.cargo, cargo.id);
  delivery.boat.x = delivery.dock.x; delivery.boat.y = delivery.dock.y;
  delivery.boat.vx = 100; delivery.interact();
  assert.equal(delivery.boat.cargo, cargo.id);
  delivery.boat.vx = 0; delivery.interact();
  assert.equal(delivery.boat.cargo, null);
}
assert.equal(delivery.status, "won");
assert.equal(delivery.delivered, 3);
const terminal = delivery.snapshot();
delivery.update(1 / 60, { ...neutralInput(), x: 1 });
assert.equal(delivery.snapshot(), terminal);
const timeout = new HarborModel();
for (let i = 0; i < 9000; i++) timeout.update(1 / 60);
assert.equal(timeout.status, "lost");
assert.equal(timeout.remaining, 0);
const collision = new HarborModel();
collision.boat.x = collision.buoys[0].x; collision.boat.y = collision.buoys[0].y;
collision.update(1 / 60);
assert.equal(collision.boat.health, 84);
assert.equal(collision.collisions, 1);
let ticks = 0;
const engine = new Engine(() => { ticks++; });
engine.advance(0); engine.advance(5000);
assert.equal(ticks, 120);
engine.advance(5000); engine.advance(5000);
assert.equal(ticks, 300);
engine.synchronize(100000); engine.advance(100000);
assert.equal(ticks, 300);
console.log("PASS: boundaries, bounded particles, render purity, pickup, delivery, docking speed, win, timeout, collision, catch-up, pause synchronization.");

function sail(model, target, tape) {
  for (let tick = 0; tick < 1800; tick++) {
    const controls = { ...neutralInput(), target: { ...target } };
    model.update(1 / 60, controls);
    tape.push(controls);
    assert.equal(model.boat.health, 100, "Navigation must avoid buoy damage");
    assert.equal(model.status, "playing", "Voyage must remain playable");
    if (Math.hypot(model.boat.x - target.x, model.boat.y - target.y) < 5 && Math.hypot(model.boat.vx, model.boat.vy) < 18) return;
  }
  assert.fail("Navigation did not reach its destination");
}

let completeTape;
for (const order of [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]) {
  for (const delay of [0, 227, 619]) {
    const voyage = new HarborModel();
    const tape = [];
    for (let tick = 0; tick < delay; tick++) { const controls = neutralInput(); voyage.update(1 / 60, controls); tape.push(controls); }
    for (const id of order) {
      const cargo = voyage.cargo[id - 1];
      sail(voyage, { x: cargo.x, y: cargo.y }, tape);
      const pickup = { ...neutralInput(), interact: true };
      voyage.update(1 / 60, pickup); tape.push(pickup);
      assert.equal(voyage.boat.cargo, id);
      sail(voyage, { x: voyage.dock.x, y: voyage.dock.y }, tape);
      const unload = { ...neutralInput(), interact: true };
      voyage.update(1 / 60, unload); tape.push(unload);
      assert.equal(voyage.boat.cargo, null);
    }
    assert.equal(voyage.status, "won");
    assert.equal(voyage.delivered, 3);
    assert.equal(voyage.collisions, 0);
    assert.equal(voyage.boat.health, 100);
    completeTape = tape;
  }
}
assert.equal(verifyTiming(completeTape).passed, true);
for (const target of [{ x: 593, y: 473 }, { x: 855, y: 568 }, { x: 356, y: 595 }, { x: -100, y: -100 }, { x: 2000, y: 2000 }]) {
  const voyage = new HarborModel();
  for (let tick = 0; tick < 1800; tick++) voyage.update(1 / 60, { ...neutralInput(), target });
  assert.equal(voyage.boat.health, 100, "Blocked or out-of-bounds destinations must remain safe");
  assert.ok(voyage.boat.x >= 72 && voyage.boat.x <= 1128 && voyage.boat.y >= 444 && voyage.boat.y <= 642);
}
const override = new HarborModel();
override.update(1 / 60, { ...neutralInput(), target: { x: 988, y: 478 } });
assert.ok(override.navigation);
override.update(1 / 60, { ...neutralInput(), x: -1 });
assert.equal(override.navigation, null);
console.log("PASS: 18 full voyages, all six delivery orders, varying buoy phases, zero damage, safe blocked targets, manual override, complete voyage replay at all five frame schedules.");
