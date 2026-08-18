import createSortModule from "./dist/sort.mjs";

const canvas = document.getElementById("viz-canvas");
const ctx = canvas.getContext("2d");
const algorithmSelect = document.getElementById("algorithm-select");
const speedSlider = document.getElementById("speed-slider");
const sizeSlider = document.getElementById("size-slider");
const shuffleBtn = document.getElementById("shuffle-btn");
const playBtn = document.getElementById("play-btn");

const COLORS = {
  background: "#1e40af",
  bar: "#f8fafc",
  compare: "#fbbf24",
  swap: "#f87171",
  sorted: "#34d399",
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
let highlights = new Map();
let sortedIndices = new Set();
let animating = false;

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

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, w, h);

  const n = array.length;
  if (n === 0) return;

  const gap = Math.min(3, w / n / 4);
  const barWidth = Math.max(1, (w - gap * (n - 1)) / n);
  const maxVal = Math.max(...array);
  const padding = 16;

  for (let i = 0; i < n; i++) {
    const value = array[i];
    const barHeight = (value / maxVal) * (h - padding * 2);
    const x = i * (barWidth + gap);
    const y = h - padding - barHeight;
    ctx.fillStyle = sortedIndices.has(i)
      ? COLORS.sorted
      : highlights.get(i) || COLORS.bar;
    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

function resetArray() {
  const size = Number(sizeSlider.value);
  array = randomArray(size);
  highlights.clear();
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

function applyStep(step) {
  highlights.clear();
  switch (step.type) {
    case Module.StepType.Compare.value:
      highlights.set(step.i, COLORS.compare);
      highlights.set(step.j, COLORS.compare);
      break;
    case Module.StepType.Swap.value: {
      const tmp = array[step.i];
      array[step.i] = array[step.j];
      array[step.j] = tmp;
      highlights.set(step.i, COLORS.swap);
      highlights.set(step.j, COLORS.swap);
      break;
    }
    case Module.StepType.Overwrite.value:
      array[step.i] = step.value_i;
      highlights.set(step.i, COLORS.swap);
      break;
    case Module.StepType.SetSorted.value:
      sortedIndices.add(step.i);
      break;
  }
}

function play() {
  if (animating) return Promise.resolve();
  animating = true;
  setControlsDisabled(true);
  playBtn.disabled = true;

  const steps = runSort(algorithmSelect.value, array.slice());
  highlights.clear();
  sortedIndices.clear();

  let stepIndex = 0;
  let lastTime = performance.now();
  let accumulator = 0;

  return new Promise((resolve) => {
    function tick(now) {
      const delay = speedToDelayMs();
      accumulator += now - lastTime;
      lastTime = now;

      while (accumulator >= delay && stepIndex < steps.length) {
        applyStep(steps[stepIndex]);
        stepIndex++;
        accumulator -= delay;
      }
      draw();

      if (stepIndex >= steps.length) {
        highlights.clear();
        for (let i = 0; i < array.length; i++) sortedIndices.add(i);
        draw();
        animating = false;
        setControlsDisabled(false);
        playBtn.disabled = false;
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
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
