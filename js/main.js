"use strict";

(function () {
  const element = id => document.getElementById(id);
  const canvas = element("scene");
  const renderer = new HarborRenderer(canvas);
  const keys = new Set();
  const touch = new Set();
  let model = new Harbor.HarborModel();
  let mode = "ready";
  let target = null;
  let actionPending = false;
  let recording = [];
  let savedRecording = [];
  let replayIndex = 0;
  let replaying = false;
  let renderLimit = 0;
  let lastRender = -Infinity;
  let lastSample = 0;
  let sampleFrames = 0;
  let sampleUpdates = 0;
  let currentAlpha = 1;
  let dirty = true;
  let maxCatchUp = 0;
  let lastMessage = "";
  let traceTicks = 0;
  let traceFrames = 0;
  const mappedKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space", "KeyE", "KeyP", "Escape"]);

  function input() {
    const held = (code, arrow, direction) => keys.has(code) || keys.has(arrow) || touch.has(direction);
    const x = Number(held("KeyD", "ArrowRight", "right")) - Number(held("KeyA", "ArrowLeft", "left"));
    const y = Number(held("KeyS", "ArrowDown", "down")) - Number(held("KeyW", "ArrowUp", "up"));
    const brake = keys.has("Space") || touch.has("brake");
    if (x || y || brake) target = null;
    const value = { x, y, brake, interact: actionPending, target: target ? { ...target } : null };
    actionPending = false;
    return value;
  }

  const engine = new FixedStepEngine(dt => {
    if (mode !== "playing") return false;
    if (replaying && replayIndex >= savedRecording.length) {
      mode = "paused";
      showOverlay("REPLAY FINISHED", "Voyage replayed.", "The recorded inputs have been reproduced using the same fixed simulation steps.", "Resume voyage");
      replaying = false;
      recording = savedRecording.slice();
      return false;
    }
    const controls = replaying ? savedRecording[replayIndex++] : input();
    if (!replaying) recording.push(controls);
    model.update(dt, controls);
    if (element("console-trace").checked && traceTicks < 120) {
      console.log("tick: " + model.tick + " boat.x: " + model.boat.x + " boat.y: " + model.boat.y);
      traceTicks += 1;
    }
    sampleUpdates += 1;
    if (model.status !== "playing") finish();
    return true;
  });

  function clearInput() {
    keys.clear(); touch.clear(); target = null; actionPending = false;
    document.querySelectorAll("[data-direction]").forEach(button => button.classList.remove("active"));
  }

  function showOverlay(eyebrow, title, copy, label) {
    element("overlay-eyebrow").textContent = eyebrow;
    element("overlay-title").textContent = title;
    element("overlay-copy").textContent = copy;
    element("start").textContent = label;
    element("overlay-note").textContent = "WASD or arrows to steer · Space to brake · E to load or unload";
    element("overlay").hidden = false;
    element("pause").textContent = "Resume";
    dirty = true;
  }

  function start(replay = false) {
    clearInput();
    if (!replay && recording.length) savedRecording = recording.slice();
    model = new Harbor.HarborModel();
    recording = [];
    replayIndex = 0;
    replaying = replay;
    mode = "playing";
    engine.reset();
    element("overlay").hidden = true;
    element("pause").disabled = false;
    element("pause").textContent = "Pause";
    lastRender = -Infinity;
    currentAlpha = 1;
    traceTicks = 0;
    traceFrames = 0;
    sampleFrames = 0;
    sampleUpdates = 0;
    lastSample = performance.now();
    canvas.focus({ preventScroll: true });
    dirty = true;
  }

  function resume() {
    mode = "playing";
    engine.synchronize(performance.now());
    element("overlay").hidden = true;
    element("pause").textContent = "Pause";
    canvas.focus({ preventScroll: true });
    dirty = true;
  }

  function pause() {
    if (mode === "playing") {
      mode = "paused";
      clearInput();
      showOverlay("SHIFT ON HOLD", "Take a breath.", "Your cargo, hull, and shift timer are safe. Resume when you are ready.", "Resume voyage");
    } else if (mode === "paused") resume();
  }

  function finish() {
    mode = "finished";
    clearInput();
    if (!replaying) savedRecording = recording.slice();
    const wasReplay = replaying;
    replaying = false;
    element("pause").disabled = true;
    if (model.status === "won") {
      const rank = model.collisions === 0 ? "HARBORMASTER" : "SHIFT COMPLETE";
      showOverlay(wasReplay ? "REPLAY COMPLETE" : rank, "Home before dawn.", "All three shipments delivered. " + model.score + " points, " + model.boat.health + "% hull integrity, and " + Math.ceil(model.remaining) + " seconds to spare.", "Sail again");
    } else {
      showOverlay("SHIFT ENDED", model.boat.health <= 0 ? "The tug needs repairs." : "Dawn has arrived.", model.delivered + " of 3 shipments delivered. Brake before docking and steer around the red buoys. Your next shift is a fresh start.", "Try again");
    }
  }

  function updateInterface() {
    element("manifest").innerHTML = model.delivered + " <small>/ 3 delivered</small>";
    const seconds = Math.ceil(model.remaining);
    element("timer").textContent = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    element("hull").innerHTML = model.boat.health + "<small>%</small>";
    element("hull-fill").style.width = model.boat.health + "%";
    element("hull-fill").style.background = model.boat.health < 40 ? "#db876c" : "#91cabc";
    element("score").textContent = String(model.score).padStart(4, "0");
    const message = replaying ? "Replaying your recorded voyage. Live steering is disabled." : mode === "ready" ? "Your tug is ready at the west berth." : model.prompt();
    if (lastMessage !== message) { element("message").textContent = message; lastMessage = message; }
    element("cargo-status").textContent = model.boat.cargo === null ? "HOLD EMPTY" : "CARGO 0" + model.boat.cargo + " ABOARD";
    element("tick").textContent = model.tick;
    element("steps").textContent = maxCatchUp;
    element("replay").disabled = replaying || !(recording.length || savedRecording.length);
    element("interact").disabled = mode !== "playing" || replaying;
  }

  function frame(timestamp) {
    if (mode === "playing") {
      if (engine.lastTime !== null && timestamp - engine.lastTime > 2000) {
        pause();
        engine.synchronize(timestamp);
      } else {
        currentAlpha = engine.advance(timestamp);
        maxCatchUp = Math.max(maxCatchUp, engine.lastSteps);
      }
    } else engine.synchronize(timestamp);
    const interval = renderLimit ? 1000 / renderLimit : 0;
    if (dirty || (mode === "playing" && timestamp - lastRender + 0.1 >= interval)) {
      const alpha = mode === "playing" && element("interpolation").checked ? currentAlpha : 1;
      renderer.draw(model, alpha, target);
      if (mode === "playing" && element("console-trace").checked && traceTicks <= 120) {
        console.log("frame: " + ++traceFrames + " tick: " + model.tick);
        if (traceTicks === 120) traceTicks = 121;
      }
      updateInterface();
      sampleFrames += 1;
      if (interval && Number.isFinite(lastRender)) lastRender = timestamp - ((timestamp - lastRender) % interval);
      else lastRender = timestamp;
      dirty = false;
    }
    if (timestamp - lastSample >= 1000) {
      const duration = (timestamp - lastSample) / 1000;
      element("fps").textContent = Math.round(sampleFrames / duration);
      element("ups").textContent = Math.round(sampleUpdates / duration);
      sampleFrames = 0; sampleUpdates = 0; lastSample = timestamp; maxCatchUp = 0;
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", event => {
    if (event.target.matches("select, input, button, summary, a")) return;
    if (!mappedKeys.has(event.code)) return;
    event.preventDefault();
    if ((event.code === "KeyP" || event.code === "Escape") && !event.repeat) { pause(); return; }
    if (mode !== "playing" || replaying) return;
    keys.add(event.code);
    if (event.code === "KeyE" && !event.repeat) actionPending = true;
  });
  window.addEventListener("keyup", event => { keys.delete(event.code); });
  window.addEventListener("blur", () => { clearInput(); if (mode === "playing") pause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { clearInput(); if (mode === "playing") pause(); } });
  canvas.addEventListener("pointerdown", event => {
    if (mode !== "playing" || replaying) return;
    const bounds = canvas.getBoundingClientRect();
    target = { x: Harbor.clamp((event.clientX - bounds.left) / bounds.width * 1200, 72, 1128), y: Harbor.clamp((event.clientY - bounds.top) / bounds.height * 680, 444, 642) };
    canvas.focus({ preventScroll: true });
  });
  element("start").addEventListener("click", () => mode === "paused" ? resume() : start());
  element("restart").addEventListener("click", () => start());
  element("pause").addEventListener("click", pause);
  element("interact").addEventListener("click", () => { if (mode === "playing" && !replaying) actionPending = true; canvas.focus({ preventScroll: true }); });
  element("fps-limit").addEventListener("change", event => { renderLimit = Number(event.target.value); lastRender = -Infinity; dirty = true; });
  element("interpolation").addEventListener("change", () => { dirty = true; });
  element("console-trace").addEventListener("change", () => {
    traceTicks = 0;
    traceFrames = 0;
    if (element("console-trace").checked) console.log("Fixed simulation step: 1/60 second. Replay the same voyage at different render limits to compare tick positions.");
  });
  element("replay").addEventListener("click", () => {
    if (recording.length) savedRecording = recording.slice();
    if (savedRecording.length) start(true);
  });
  element("verify").addEventListener("click", () => {
    if (mode === "playing") pause();
    element("verification-result").textContent = "Comparing simulation states...";
    element("verify").disabled = true;
    setTimeout(() => {
      try {
        const tape = recording.length ? recording : savedRecording.length ? savedRecording : null;
        const result = HarborVerification.verifyTiming(tape);
        console.table(result.results);
        element("verification-result").textContent = result.passed ? "PASS. Every simulation state matched at every tick across all five schedules." : "FAIL. A simulation mismatch was detected.";
        element("verification-detail").textContent = result.results.map(row => row.schedule + ": " + row.ticks + " ticks, " + (row.passed ? "identical" : "mismatch at " + row.mismatch)).join("\n");
      } catch (error) {
        element("verification-result").textContent = "Verification failed: " + error.message;
      } finally { element("verify").disabled = false; }
    }, 0);
  });
  document.querySelectorAll("[data-direction]").forEach(button => {
    const release = () => { touch.delete(button.dataset.direction); button.classList.remove("active"); };
    button.addEventListener("pointerdown", event => {
      if (mode !== "playing" || replaying) return;
      event.preventDefault(); button.setPointerCapture(event.pointerId); touch.add(button.dataset.direction); button.classList.add("active");
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
  console.info("Night Harbor ready. Open Engine room for render limits, console timing traces, deterministic verification, and voyage replay.");
  requestAnimationFrame(frame);
})();
