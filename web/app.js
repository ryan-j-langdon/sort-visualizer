import createSortModule from "./dist/sort.mjs";
import {
  ensureAudioContext,
  playCompareSound,
  playSwapSound,
  playSweepTickSound,
  playFinishTune,
  setMuted,
  isMuted,
} from "./audio.js";

const canvas = document.getElementById("viz-canvas");
const ctx = canvas.getContext("2d");
const algorithmSelect = document.getElementById("algorithm-select");
const speedSlider = document.getElementById("speed-slider");
const sizeSlider = document.getElementById("size-slider");
const speedTooltip = document.getElementById("speed-tooltip");
const sizeTooltip = document.getElementById("size-tooltip");
const shuffleBtn = document.getElementById("shuffle-btn");
const muteBtn = document.getElementById("mute-btn");
const playBtn = document.getElementById("play-btn");

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const COLORS = {
  bar: cssVar("--color-bar", "#60a5fa"),
  compare: cssVar("--color-compare", "#fbbf24"),
  swap: cssVar("--color-swap", "#f87171"),
  sorted: cssVar("--color-sorted", "#34d399"),
};

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function shade(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const mix = (c) => Math.round(c + (t - c) * p);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const PALETTE = {
  bar: { top: shade(COLORS.bar, 12), bottom: shade(COLORS.bar, -10) },
  sorted: { top: shade(COLORS.sorted, 15), bottom: shade(COLORS.sorted, -12), glow: withAlpha(COLORS.sorted, 0.55) },
  compare: { top: shade(COLORS.compare, 15), bottom: shade(COLORS.compare, -12), glow: withAlpha(COLORS.compare, 0.65) },
  swap: { top: shade(COLORS.swap, 15), bottom: shade(COLORS.swap, -12), glow: withAlpha(COLORS.swap, 0.65) },
  sweep: { top: "#ffffff", bottom: shade(COLORS.sorted, -5), glow: "rgba(255, 255, 255, 0.8)" },
};

const SORT_FNS = {
  bubble: "run_bubble_sort",
  insertion: "run_insertion_sort",
  selection: "run_selection_sort",
  merge: "run_merge_sort",
  quick: "run_quick_sort",
  heap: "run_heap_sort",
};

let Module = null;
let array = [];
let displayValues = [];
let highlightState = new Map();
let sortedIndices = new Set();
let animating = false;
let finishRequested = false;
let shufflePulseTimeoutId = null;

const SHUFFLE_PULSE_DELAY_MS = 1000;

function scheduleShufflePulse() {
  clearTimeout(shufflePulseTimeoutId);
  shufflePulseTimeoutId = setTimeout(() => {
    shuffleBtn.classList.add("pulse-highlight");
  }, SHUFFLE_PULSE_DELAY_MS);
}

function stopShufflePulse() {
  clearTimeout(shufflePulseTimeoutId);
  shufflePulseTimeoutId = null;
  shuffleBtn.classList.remove("pulse-highlight");
}

function randomArray(size) {
  const max = 100;
  const arr = new Array(size);
  for (let i = 0; i < size; i++) {
    arr[i] = 1 + Math.floor(Math.random() * max);
  }
  return arr;
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

const BAR_RADIUS = 4;

function fillBar(x, y, width, height, radius) {
  const h = Math.max(0, height);
  if (h <= 0 || width <= 0) return;
  const r = Math.min(radius, width / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, h, [r, r, 0, 0]);
  ctx.fill();
}

function draw(now) {
  if (now === undefined) now = performance.now();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);

  const n = array.length;
  if (n === 0) return;

  const hPadding = 16;
  const vPadding = 16;
  const usableWidth = w - hPadding * 2;
  const gap = Math.min(3, usableWidth / n / 4);
  const barWidth = Math.max(1, (usableWidth - gap * (n - 1)) / n);
  const maxVal = Math.max(...array);

  ctx.shadowBlur = 0;
  for (let i = 0; i < n; i++) {
    const barHeight = (displayValues[i] / maxVal) * (h - vPadding * 2);
    const x = hPadding + i * (barWidth + gap);
    const y = h - vPadding - barHeight;
    const kind = sortedIndices.has(i) ? "sorted" : "bar";
    const g = ctx.createLinearGradient(x, y, x, y + Math.max(1, barHeight));
    g.addColorStop(0, PALETTE[kind].top);
    g.addColorStop(1, PALETTE[kind].bottom);
    ctx.fillStyle = g;
    fillBar(x, y, barWidth, barHeight, BAR_RADIUS);
  }

  for (const [i, hi] of highlightState) {
    const t = clamp01((now - hi.startTime) / hi.duration);
    if (t >= 1) {
      highlightState.delete(i);
      continue;
    }
    const alpha = 1 - t * t * (3 - 2 * t);
    const barHeight = (displayValues[i] / maxVal) * (h - vPadding * 2);
    const x = hPadding + i * (barWidth + gap);
    const y = h - vPadding - barHeight;
    const p = PALETTE[hi.color];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.glow;
    ctx.shadowBlur = 14;
    const g = ctx.createLinearGradient(x, y, x, y + Math.max(1, barHeight));
    g.addColorStop(0, p.top);
    g.addColorStop(1, p.bottom);
    ctx.fillStyle = g;
    fillBar(x, y, barWidth, barHeight, BAR_RADIUS);
    ctx.restore();
  }
}

function resetArray() {
  const size = Number(sizeSlider.value);
  array = randomArray(size);
  displayValues = array.slice();
  highlightState.clear();
  sortedIndices.clear();
}

function setControlsDisabled(disabled) {
  algorithmSelect.disabled = disabled;
  sizeSlider.disabled = disabled;
  shuffleBtn.disabled = disabled;
}

function speedToDelayMs() {
  const speed = Number(speedSlider.value); // 1 (slow) - 100 (fast)
  const minDelay = 0.5;
  const maxDelay = 180;
  const t = (speed - 1) / 99;
  // Apply an ease through the speed range while preserving the endpoints.
  const eased = t * t * t * (t * (t * 6 - 15) + 10);
  return maxDelay + (minDelay - maxDelay) * eased;
}

function syncSpeedTooltip() {
  const speed = Number(speedSlider.value);
  speedTooltip.textContent = `${(speed / 100).toFixed(2)}x`;
}

function syncSizeTooltip() {
  sizeTooltip.textContent = `${sizeSlider.value} elements`;
}

function stepsToJS(vec) {
  const out = new Array(vec.size());
  for (let i = 0; i < out.length; i++) {
    const s = vec.get(i);
    out[i] = { type: s.type.value, i: s.i, j: s.j, value_i: s.value_i };
  }
  return out;
}

function arrayToVectorInt(arr) {
  const vec = new Module.VectorInt();
  for (const value of arr) vec.push_back(value);
  return vec;
}

function runSort(name, arr) {
  const fnName = SORT_FNS[name];
  const vec = arrayToVectorInt(arr);
  const result = Module[fnName](vec);
  vec.delete();
  const steps = stepsToJS(result.steps);
  result.steps.delete();
  result.initial.delete();
  return steps;
}

const HIGHLIGHT_FADE_MS = 260;

function applyStep(step, now) {
  switch (step.type) {
    case Module.StepType.Compare.value:
      highlightState.set(step.i, { color: "compare", startTime: now, duration: HIGHLIGHT_FADE_MS });
      highlightState.set(step.j, { color: "compare", startTime: now, duration: HIGHLIGHT_FADE_MS });
      playCompareSound((array[step.i] + array[step.j]) / 2);
      break;
    case Module.StepType.Swap.value: {
      const tmp = array[step.i];
      array[step.i] = array[step.j];
      array[step.j] = tmp;
      highlightState.set(step.i, { color: "swap", startTime: now, duration: HIGHLIGHT_FADE_MS });
      highlightState.set(step.j, { color: "swap", startTime: now, duration: HIGHLIGHT_FADE_MS });
      playSwapSound(array[step.i]);
      break;
    }
    case Module.StepType.Overwrite.value:
      array[step.i] = step.value_i;
      highlightState.set(step.i, { color: "swap", startTime: now, duration: HIGHLIGHT_FADE_MS });
      playSwapSound(array[step.i]);
      break;
    case Module.StepType.SetSorted.value:
      sortedIndices.add(step.i);
      break;
  }
}

const HEIGHT_EASE_MS = 90;
const SWEEP_DURATION_MS = 550;
const SWEEP_FADE_MS = 260;

function approach(current, target, dtMs, timeConstantMs) {
  const k = 1 - Math.exp(-dtMs / timeConstantMs);
  return current + (target - current) * k;
}

function isVisuallySettled() {
  if (highlightState.size > 0) return false;
  for (let i = 0; i < array.length; i++) {
    if (Math.abs(displayValues[i] - array[i]) > 0.15) return false;
  }
  return true;
}

let revealToken = 0;

function animateReveal() {
  const token = ++revealToken;
  let lastTime = performance.now();

  function frame(now) {
    if (token !== revealToken) return;
    const dt = now - lastTime;
    lastTime = now;
    let settled = true;
    for (let i = 0; i < array.length; i++) {
      displayValues[i] = approach(displayValues[i], array[i], dt, HEIGHT_EASE_MS);
      if (Math.abs(displayValues[i] - array[i]) > 0.15) settled = false;
    }
    draw(now);
    if (!settled) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function play() {
  if (animating) return Promise.resolve();
  ensureAudioContext();
  stopShufflePulse();
  animating = true;
  finishRequested = false;
  setControlsDisabled(true);
  playBtn.classList.add("is-animating");
  playBtn.setAttribute("aria-label", "Finish sort");

  const steps = runSort(algorithmSelect.value, array.slice());
  highlightState.clear();
  sortedIndices.clear();

  let stepIndex = 0;
  let lastTime = performance.now();
  let accumulator = 0;
  let sortDoneAt = null;
  let sweepCursor = 0;
  let finishTuneFired = false;
  const n = array.length;

  return new Promise((resolve) => {
    function frame(now) {
      const dt = now - lastTime;
      lastTime = now;

      if (finishRequested) {
        for (; stepIndex < steps.length; stepIndex++) {
          const step = steps[stepIndex];
          if (step.type === Module.StepType.Swap.value) {
            const tmp = array[step.i];
            array[step.i] = array[step.j];
            array[step.j] = tmp;
          } else if (step.type === Module.StepType.Overwrite.value) {
            array[step.i] = step.value_i;
          }
        }
        for (let i = 0; i < n; i++) sortedIndices.add(i);
        highlightState.clear();
        displayValues = array.slice();
        sortDoneAt = now;
        sweepCursor = n;
      } else if (stepIndex < steps.length) {
        const delay = speedToDelayMs();
        accumulator += dt;
        while (accumulator >= delay && stepIndex < steps.length) {
          applyStep(steps[stepIndex], now);
          stepIndex++;
          accumulator -= delay;
        }
        if (stepIndex >= steps.length) sortDoneAt = now;
      } else if (sortDoneAt !== null) {
        const elapsed = now - sortDoneAt;
        const targetCursor = Math.min(n, Math.ceil((elapsed / SWEEP_DURATION_MS) * n));
        while (sweepCursor < targetCursor) {
          sortedIndices.add(sweepCursor);
          highlightState.set(sweepCursor, { color: "sweep", startTime: now, duration: SWEEP_FADE_MS });
          playSweepTickSound(sweepCursor / n);
          sweepCursor++;
        }
      }

      const sweepDone = sortDoneAt !== null && sweepCursor >= n;
      if (sweepDone && !finishTuneFired) {
        finishTuneFired = true;
        playFinishTune();
      }

      for (let i = 0; i < array.length; i++) {
        displayValues[i] = approach(displayValues[i], array[i], dt, HEIGHT_EASE_MS);
      }
      draw(now);

      const finished = stepIndex >= steps.length && sweepDone && isVisuallySettled();

      if (!finished) {
        requestAnimationFrame(frame);
      } else {
        animating = false;
        finishRequested = false;
        setControlsDisabled(false);
        playBtn.classList.remove("is-animating");
        playBtn.setAttribute("aria-label", "Play");
        scheduleShufflePulse();
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

shuffleBtn.addEventListener("click", () => {
  if (animating) return;
  stopShufflePulse();
  array = randomArray(array.length);
  highlightState.clear();
  sortedIndices.clear();
  animateReveal();
});

let draggingSliderControl = null;

function beginSliderDrag(control) {
  draggingSliderControl = control;
  control.classList.add("is-dragging");
}

function endSliderDrag() {
  if (draggingSliderControl) {
    draggingSliderControl.classList.remove("is-dragging");
    draggingSliderControl = null;
  }
}

speedSlider.addEventListener("pointerdown", () => beginSliderDrag(speedSlider.closest(".control")));
sizeSlider.addEventListener("pointerdown", () => beginSliderDrag(sizeSlider.closest(".control")));
window.addEventListener("pointerup", endSliderDrag);
window.addEventListener("pointercancel", endSliderDrag);

speedSlider.addEventListener("input", () => {
  syncSpeedTooltip();
});

sizeSlider.addEventListener("input", () => {
  syncSizeTooltip();
  if (animating) return;
  stopShufflePulse();
  const size = Number(sizeSlider.value);
  array = randomArray(size);
  displayValues = new Array(size).fill(0);
  highlightState.clear();
  sortedIndices.clear();
  animateReveal();
});

playBtn.addEventListener("click", () => {
  if (animating) {
    finishRequested = true;
  } else {
    play();
  }
});

function syncMuteButton() {
  const muted = isMuted();
  muteBtn.classList.toggle("is-muted", muted);
  muteBtn.setAttribute("aria-label", muted ? "Unmute sound effects" : "Mute sound effects");
}

muteBtn.addEventListener("click", () => {
  setMuted(!isMuted());
  syncMuteButton();
});

window.addEventListener("resize", resizeCanvas);

async function init() {
  Module = await createSortModule();
  resetArray();
  resizeCanvas();
  syncMuteButton();
  syncSpeedTooltip();
  syncSizeTooltip();
}

init();
