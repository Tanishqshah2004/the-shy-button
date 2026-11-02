/* ==========================================================================
   The Shy Button
   The button runs away from your pointer. After enough escapes it gets tired
   and lets you click it. Works with mouse, touch and keyboard.
   ========================================================================== */

(() => {
  "use strict";

  /* ---------- Settings ---------- */
  const MAX_ESCAPES = 10;      // dodges before the button gives up
  const FLEE_DISTANCE = 70;    // px between pointer and button edge that triggers a dodge
  const COOLDOWN_MS = 320;     // minimum time between dodges (matches the CSS transition)
  const PUPIL_TRAVEL = 5;      // px the pupils can move
  const MARGIN = { side: 30, top: 72, bottom: 16 }; // top leaves room for the speech bubble

  const EXCUSES = [
    "Oh! Hi. Not now.",
    "I wasn't ready.",
    "Please don't look at me.",
    "Too many eyes.",
    "Can we start with small talk?",
    "I need a moment.",
    "It's not you. It's clicking.",
    "I'm having a bad day. I don't have hair.",
    "What if we just wave?",
    "I'll be fine. Just give me space.",
  ];

  const TIRED_LINE = "Okay. I'm out of breath. You can click me.";
  const CAUGHT_LINE = "You did it!";

  /* ---------- Elements ---------- */
  const stage = document.getElementById("stage");
  const shy = document.getElementById("shy");
  const btn = document.getElementById("btn");
  const label = document.getElementById("label");
  const bubble = document.getElementById("bubble");
  const subtitle = document.getElementById("subtitle");
  const escapesEl = document.getElementById("escapes");
  const timeStat = document.getElementById("time-stat");
  const timeEl = document.getElementById("time");
  const resetBtn = document.getElementById("reset");
  const statusEl = document.getElementById("status");

  const DEFAULT_SUBTITLE = subtitle.textContent;

  /* ---------- State ---------- */
  const state = {
    mode: "shy",          // "shy" | "tired" | "caught"
    escapes: 0,
    x: 0,                 // button position, in stage coordinates
    y: 0,
    lastDodge: 0,
    lastExcuse: -1,
    startTime: null,
    pointer: { x: 0, y: 0 },
  };

  /* ---------- Helpers ---------- */
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  /** Allowed top-left positions for the button inside the stage. */
  function getBounds() {
    return {
      minX: MARGIN.side,
      minY: MARGIN.top,
      maxX: Math.max(MARGIN.side, stage.clientWidth - shy.offsetWidth - MARGIN.side),
      maxY: Math.max(MARGIN.top, stage.clientHeight - shy.offsetHeight - MARGIN.bottom),
    };
  }

  /** Converts a pointer event to stage coordinates. */
  function toStageCoords(event) {
    const rect = stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** Shortest distance from a point to the button's rectangle (0 if inside). */
  function distanceToButton(px, py) {
    const dx = Math.max(state.x - px, 0, px - (state.x + shy.offsetWidth));
    const dy = Math.max(state.y - py, 0, py - (state.y + shy.offsetHeight));
    return Math.hypot(dx, dy);
  }

  function moveTo(x, y) {
    state.x = x;
    state.y = y;
    shy.style.transform = `translate(${x}px, ${y}px)`;
  }

  function moveToCenter() {
    const b = getBounds();
    moveTo((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
  }

  /** Tries random spots and keeps the one farthest from the pointer and the current spot. */
  function pickSpot(px, py) {
    const b = getBounds();
    const w = shy.offsetWidth;
    const h = shy.offsetHeight;
    let best = { x: state.x, y: state.y };
    let bestScore = -Infinity;

    for (let i = 0; i < 24; i++) {
      const x = rand(b.minX, b.maxX);
      const y = rand(b.minY, b.maxY);
      const fromPointer = Math.hypot(x + w / 2 - px, y + h / 2 - py);
      const fromHere = Math.hypot(x - state.x, y - state.y);
      const score = fromPointer + fromHere * 0.5;

      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    return best;
  }

  function say(text) {
    bubble.textContent = text;
    bubble.classList.remove("pop");
    void bubble.offsetWidth; // restart the animation
    bubble.classList.add("pop");
  }

  function nextExcuse() {
    let index;
    do {
      index = Math.floor(Math.random() * EXCUSES.length);
    } while (index === state.lastExcuse);
    state.lastExcuse = index;
    return EXCUSES[index];
  }

  function announce(text) {
    statusEl.textContent = text;
  }

  /* ---------- Eyes ---------- */
  /** Shy: pupils look away from the pointer. Tired: they look at it. Caught: centered. */
  function updateEyes(px, py) {
    let lx = 0;
    let ly = 0;

    if (state.mode !== "caught") {
      const cx = state.x + shy.offsetWidth / 2;
      const cy = state.y + shy.offsetHeight / 2;
      const angle = Math.atan2(py - cy, px - cx);
      const direction = state.mode === "shy" ? -1 : 1;
      lx = Math.cos(angle) * PUPIL_TRAVEL * direction;
      ly = Math.sin(angle) * PUPIL_TRAVEL * direction;
    }

    shy.style.setProperty("--lx", `${lx.toFixed(1)}px`);
    shy.style.setProperty("--ly", `${ly.toFixed(1)}px`);
  }

  /* ---------- Modes ---------- */
  function setMode(mode) {
    state.mode = mode;
    shy.dataset.state = mode;

    if (mode === "tired") {
      label.textContent = "Fine.";
      say(TIRED_LINE);
      announce("The button is out of breath. You can click it now.");
    }

    if (mode === "caught") {
      const seconds = ((performance.now() - state.startTime) / 1000).toFixed(1);
      label.textContent = "Yay";
      say(CAUGHT_LINE);
      subtitle.textContent = "Nothing happened. The button is very proud of you.";
      timeEl.textContent = seconds;
      timeStat.hidden = false;
      resetBtn.hidden = false;
      announce(`You clicked it after ${state.escapes} escapes and ${seconds} seconds. Nothing happened.`);
      updateEyes(0, 0);
    }
  }

  function reset() {
    state.mode = "shy";
    state.escapes = 0;
    state.startTime = null;
    state.lastExcuse = -1;

    shy.dataset.state = "shy";
    shy.style.setProperty("--blush", 0);
    escapesEl.textContent = "0";
    label.textContent = "Click me";
    subtitle.textContent = DEFAULT_SUBTITLE;
    timeStat.hidden = true;
    resetBtn.hidden = true;
    say("Oh! Hi.");
    moveToCenter();
    announce("The button is shy again.");
    btn.focus({ preventScroll: true });
  }

  /* ---------- Dodge ---------- */
  function dodge(px, py) {
    const now = performance.now();
    state.lastDodge = now;
    if (state.startTime === null) state.startTime = now;

    state.escapes += 1;
    escapesEl.textContent = state.escapes;
    shy.style.setProperty("--blush", Math.min(state.escapes / MAX_ESCAPES, 1));

    const spot = pickSpot(px, py);
    moveTo(spot.x, spot.y);

    if (state.escapes >= MAX_ESCAPES) {
      setMode("tired"); // one last dash, then it gives up
    } else {
      say(nextExcuse());
    }
  }

  /* ---------- Events ---------- */
  /** Mouse hover and touch-drag: run if the pointer gets close. */
  function handlePointerMove(event) {
    const { x, y } = toStageCoords(event);
    state.pointer = { x, y };
    updateEyes(x, y);

    if (state.mode !== "shy") return;
    if (performance.now() - state.lastDodge < COOLDOWN_MS) return;
    if (distanceToButton(x, y) < FLEE_DISTANCE) dodge(x, y);
  }

  /** Touch taps have no hover, so check on press as well. */
  function handlePointerDown(event) {
    handlePointerMove(event);
  }

  function handleClick(event) {
    if (state.mode === "shy") {
      // Keyboard or a very quick tap: it still escapes.
      event.preventDefault();
      const cx = state.x + shy.offsetWidth / 2;
      const cy = state.y + shy.offsetHeight / 2;
      dodge(cx, cy);
      return;
    }

    if (state.mode === "tired") setMode("caught");
  }

  function handleResize() {
    const b = getBounds();
    moveTo(clamp(state.x, b.minX, b.maxX), clamp(state.y, b.minY, b.maxY));
  }

  document.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("pointerdown", handlePointerDown);
  btn.addEventListener("click", handleClick);
  resetBtn.addEventListener("click", reset);
  // The stage also changes size when the footer grows or shrinks (e.g. after the
  // button is caught), so watch the stage itself rather than only the window.
  if ("ResizeObserver" in window) {
    new ResizeObserver(handleResize).observe(stage);
  } else {
    window.addEventListener("resize", handleResize);
  }

  /* ---------- Start ---------- */
  moveToCenter();
})();
