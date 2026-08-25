const MUTE_KEY = "sortViz.muted";
const MASTER_VOLUME = 0.18;
const MIN_SOUND_INTERVAL = 0.02;

let audioCtx = null;
let masterGain = null;
let lastSoundAt = -Infinity;

let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === "1";
} catch {
  muted = false;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {}
}

export function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = MASTER_VOLUME;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function valueToFreq(value, minFreq, maxFreq) {
  const t = clamp01((value - 1) / 99);
  return minFreq + (maxFreq - minFreq) * t;
}

function throttled() {
  const now = audioCtx.currentTime;
  if (now - lastSoundAt < MIN_SOUND_INTERVAL) return true;
  lastSoundAt = now;
  return false;
}

function playTone({ freq, type = "sine", duration = 0.05, peakGain = 0.2, attack = 0.004, startTime }) {
  const t0 = startTime ?? audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

export function playCompareSound(value) {
  if (muted || !audioCtx || throttled()) return;
  playTone({ freq: valueToFreq(value, 500, 1000), type: "sine", duration: 0.05, peakGain: 0.09, attack: 0.003 });
}

export function playSwapSound(value) {
  if (muted || !audioCtx || throttled()) return;
  playTone({ freq: valueToFreq(value, 160, 420), type: "triangle", duration: 0.08, peakGain: 0.13, attack: 0.003 });
}

export function playSweepTickSound(progress) {
  if (muted || !audioCtx || throttled()) return;
  playTone({ freq: 500 + clamp01(progress) * 900, type: "sine", duration: 0.045, peakGain: 0.08, attack: 0.002 });
}

const FINISH_TUNE_NOTES = [523.25, 659.25, 783.99, 1046.5];
const FINISH_NOTE_GAP = 0.09;
const FINISH_NOTE_DURATION = 0.14;

export function playFinishTune() {
  if (muted || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  FINISH_TUNE_NOTES.forEach((freq, idx) => {
    playTone({
      freq,
      type: idx === FINISH_TUNE_NOTES.length - 1 ? "triangle" : "sine",
      duration: FINISH_NOTE_DURATION,
      peakGain: 0.16,
      attack: 0.005,
      startTime: t0 + idx * FINISH_NOTE_GAP,
    });
  });
}
