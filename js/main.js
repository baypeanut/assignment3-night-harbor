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
      showOverlay("", "Replay finished", "That was your recorded run. You can keep playing from here or restart.", "Keep playing");
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
    element("overlay-note").textContent = "WASD or arrows: move · Space: brake · E: pick up or deliver";
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
      showOverlay("", "Paused", "The timer is stopped. Resume whenever you are ready.", "Resume");
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
      showOverlay("", wasReplay ? "Replay finished" : "All crates delivered!", "Score: " + model.score + ". Hull: " + model.boat.health + "%. You had " + Math.ceil(model.remaining) + " seconds left.", "Play again");
    } else {
      showOverlay("", model.boat.health <= 0 ? "Boat damaged" : "Time is up", "You delivered " + model.delivered + " of 3 crates. Try again and watch out for the buoys.", "Try again");
    }
  }

  function updateInterface() {
    element("manifest").textContent = model.delivered + " / 3";
    const seconds = Math.ceil(model.remaining);
    element("timer").textContent = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    element("hull").textContent = model.boat.health + "%";
    element("score").textContent = model.score;
    const message = replaying ? "Replaying your run. Steering is off during the replay." : mode === "ready" ? "Your boat is at the dock." : model.prompt();
    if (lastMessage !== message) { element("message").textContent = message; lastMessage = message; }
    element("cargo-status").textContent = model.boat.cargo === null ? "No crate aboard" : "Carrying crate " + model.boat.cargo;
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
    if (savedRecording.length) { element("settings").close(); start(true); }
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
        element("verification-result").textContent = result.passed ? "Passed. All five frame rates produced the same state at every tick." : "Failed. The simulation states did not match.";
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
  element("settings-open").addEventListener("click", () => { clearInput(); element("settings").showModal(); });
  element("settings-close").addEventListener("click", () => { element("settings").close(); if (mode === "playing") canvas.focus({ preventScroll: true }); });
  console.info("Night Harbor ready. Settings has frame-rate controls, console timing traces, a timing test, and replay.");
  requestAnimationFrame(frame);
})();
