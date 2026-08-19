import createSortModule from "./dist/sort.mjs";

const canvas = document.getElementById("viz-canvas");
const ctx = canvas.getContext("2d");
const algorithmSelect = document.getElementById("algorithm-select");
const speedSlider = document.getElementById("speed-slider");
const sizeSlider = document.getElementById("size-slider");
const shuffleBtn = document.getElementById("shuffle-btn");
const playBtn = document.getElementById("play-btn");

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const COLORS = {
  background: cssVar("--color-viz-bg", "#1e3a8a"),
  backgroundTop: cssVar("--color-viz-bg-top", "#1e40af"),
  bar: cssVar("--color-bar", "#f8fafc"),
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
let bgGradient = null;
let bgGradientH = -1;

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
  bgGradientH = -1;
  draw();
}

function draw(now) {
  if (now === undefined) now = performance.now();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  if (!bgGradient || bgGradientH !== h) {
    bgGradient = ctx.createLinearGradient(0, 0, 0, h);
    bgGradient.addColorStop(0, COLORS.backgroundTop);
    bgGradient.addColorStop(1, COLORS.background);
    bgGradientH = h;
  }
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, w, h);

  const n = array.length;
  if (n === 0) return;

  const gap = Math.min(3, w / n / 4);
  const barWidth = Math.max(1, (w - gap * (n - 1)) / n);
  const maxVal = Math.max(...array);
  const padding = 16;

  ctx.shadowBlur = 0;
  for (let i = 0; i < n; i++) {
    const barHeight = (displayValues[i] / maxVal) * (h - padding * 2);
    const x = i * (barWidth + gap);
    const y = h - padding - barHeight;
    const kind = sortedIndices.has(i) ? "sorted" : "bar";
    const g = ctx.createLinearGradient(x, y, x, y + Math.max(1, barHeight));
    g.addColorStop(0, PALETTE[kind].top);
    g.addColorStop(1, PALETTE[kind].bottom);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, barWidth, Math.max(0, barHeight));
  }

  for (const [i, hi] of highlightState) {
    const t = clamp01((now - hi.startTime) / hi.duration);
    if (t >= 1) {
      highlightState.delete(i);
      continue;
    }
    const alpha = 1 - t * t * (3 - 2 * t);
    const barHeight = (displayValues[i] / maxVal) * (h - padding * 2);
    const x = i * (barWidth + gap);
    const y = h - padding - barHeight;
    const p = PALETTE[hi.color];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.glow;
    ctx.shadowBlur = 14;
    const g = ctx.createLinearGradient(x, y, x, y + Math.max(1, barHeight));
    g.addColorStop(0, p.top);
    g.addColorStop(1, p.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, barWidth, Math.max(0, barHeight));
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
  return maxDelay - t * (maxDelay - minDelay);
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
      break;
    case Module.StepType.Swap.value: {
      const tmp = array[step.i];
      array[step.i] = array[step.j];
      array[step.j] = tmp;
      highlightState.set(step.i, { color: "swap", startTime: now, duration: HIGHLIGHT_FADE_MS });
      highlightState.set(step.j, { color: "swap", startTime: now, duration: HIGHLIGHT_FADE_MS });
      break;
    }
    case Module.StepType.Overwrite.value:
      array[step.i] = step.value_i;
      highlightState.set(step.i, { color: "swap", startTime: now, duration: HIGHLIGHT_FADE_MS });
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

function play() {
  if (animating) return Promise.resolve();
  animating = true;
  setControlsDisabled(true);
  playBtn.disabled = true;

  const steps = runSort(algorithmSelect.value, array.slice());
  highlightState.clear();
  sortedIndices.clear();

  let stepIndex = 0;
  let lastTime = performance.now();
  let accumulator = 0;
  let sortDoneAt = null;
  let sweepCursor = 0;
  const n = array.length;

  return new Promise((resolve) => {
    function frame(now) {
      const dt = now - lastTime;
      lastTime = now;

      if (stepIndex < steps.length) {
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
          sweepCursor++;
        }
      }

      for (let i = 0; i < array.length; i++) {
        displayValues[i] = approach(displayValues[i], array[i], dt, HEIGHT_EASE_MS);
      }
      draw(now);

      const sweepDone = sortDoneAt !== null && sweepCursor >= n;
      const finished = stepIndex >= steps.length && sweepDone && isVisuallySettled();

      if (!finished) {
        requestAnimationFrame(frame);
      } else {
        animating = false;
        setControlsDisabled(false);
        playBtn.disabled = false;
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

shuffleBtn.addEventListener("click", () => {
  if (animating) return;
  resetArray();
  draw();
});

sizeSlider.addEventListener("input", () => {
  if (animating) return;
  resetArray();
  draw();
});

playBtn.addEventListener("click", () => {
  play();
});

window.addEventListener("resize", resizeCanvas);

async function init() {
  Module = await createSortModule();
  resetArray();
  resizeCanvas();
}

init();
