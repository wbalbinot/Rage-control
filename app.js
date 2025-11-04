/*
  Mic monitor — simple and configurable
  Adjustable parameters are at the top of the file.
  Uses Web Audio API to compute RMS -> dB and updates the UI.
*/

// ----------------- Adjustable parameters -----------------
const CONFIG = {
  smoothingTimeConstant: 1, // analyser smoothing (0..1) - decreased for faster response to shouts
  fftSize: 2048, // analyser FFT size
  updateIntervalMs: 60, // UI update interval
  rmsToDbOffset: 6, // extra offset in dB - boosted to detect loud sounds better
  beepOnThreshold: true, // enable beep for rage alerts
  beepMinLevel: 0.85, // only beep when rage level is very high (normalized > 0.85)
  beepCooldownMs: 500, // minimum ms between beeps to avoid spam
  // defaults used in auto-start mode (no visible controls)
  defaultCalibrationDb: -34, // raised to ignore normal talking
  defaultThresholdDb: -8, // higher threshold - only trigger on actual shouting
  defaultSensitivity: 1.2, // slightly increased sensitivity
  autoStart: true,
};
// ----------------------------------------------------------

// Local alias for defaults
const DEFAULT_CALIB = CONFIG.defaultCalibrationDb;
const DEFAULT_THRESHOLD = CONFIG.defaultThresholdDb;
const DEFAULT_SENSITIVITY = CONFIG.defaultSensitivity;
const AUTO_START = CONFIG.autoStart;

let audioCtx = null;
let analyser = null;
let micStream = null;
let rafId = null;
let updateTimer = null;

function setStatus (s) { console.log('[Status]', s); }

function clamp (v, a, b) { return Math.max(a, Math.min(b, v)); }

// Convert RMS (0..1) to dBFS approximated
function rmsToDb (rms) {
  // avoid log(0)
  const min = 1e-8;
  const db = 20 * Math.log10(Math.max(rms, min));
  return db + CONFIG.rmsToDbOffset;
}

// Map dB threshold region to 0..1 for color interpolation
function dbToNormalized (db, minDb = -60, maxDb = 0) {
  return clamp((db - minDb) / (maxDb - minDb), 0, 1);
}

// Interpolate color from green (0) to red (1)
function colorForNorm (n) {
  // More aggressive color interpolation:
  // - Stay green longer (up to 60% of range)
  // - Quick transition through yellow
  // - Go red faster when loud
  const normalized = Math.pow(n, 1.5); // Make the transition more aggressive
  const r = Math.round(255 * Math.min(1, normalized * 2)); // Red comes in faster
  const g = Math.round(255 * Math.max(0, n < 0.6 ? 1 : (1 - normalized) * 2)); // Stay green longer
  return `rgb(${r},${g},0)`;
}

function updatePageBackground (color) {
  document.body.style.background = color;
}

function updateUI (db) {
  const norm = dbToNormalized(db, DEFAULT_CALIB, 0);
  // color progression
  const color = colorForNorm(norm);
  updatePageBackground(color);

  // threshold and rage level check
  const thr = DEFAULT_THRESHOLD;
  if (db >= thr) {
    if (norm >= CONFIG.beepMinLevel) {
      console.debug('[Level]', db.toFixed(1), 'dB', '(RAGE!)');
      if (CONFIG.beepOnThreshold) { playBeep(); }
    } else {
      console.debug('[Level]', db.toFixed(1), 'dB', '(loud)');
    }
  } else {
    console.debug('[Level]', db.toFixed(1), 'dB');
  }
}

function analyzeOnce () {
  if (!analyser) return;
  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);
  // compute RMS
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  const rms = Math.sqrt(sum / buffer.length) * DEFAULT_SENSITIVITY;
  const db = rmsToDb(rms);
  updateUI(db);
}

function startMonitoring () {
  if (audioCtx) return;
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    micStream = stream;
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = CONFIG.fftSize;
    analyser.smoothingTimeConstant = CONFIG.smoothingTimeConstant;
    src.connect(analyser);
    setStatus('running');
    // periodic updates
    updateTimer = setInterval(analyzeOnce, CONFIG.updateIntervalMs);
  }).catch(err => {
    console.error('Microphone access failed:', err);
    setStatus('error');
  });
}

function stopMonitoring () {
  if (!audioCtx) return;
  clearInterval(updateTimer);
  updateTimer = null;
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  audioCtx.close();
  audioCtx = null;
  analyser = null;
  setStatus('idle');
}

// Track last beep time for cooldown
let lastBeepTime = 0;

function playBeep () {
  if (!audioCtx) return;

  // Check cooldown
  const now = audioCtx.currentTime;
  const msSinceLastBeep = (Date.now() - lastBeepTime);
  if (msSinceLastBeep < CONFIG.beepCooldownMs) return;
  lastBeepTime = Date.now();

  // Create Windows-style error sound (two-tone siren)
  const duration = 0.6; // longer sound for more impact

  // Create oscillators for two-tone effect
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  // Use sawtooth wave for that classic Windows error sound
  osc1.type = 'sawtooth';
  osc2.type = 'sawtooth';

  // Classic Windows error frequencies
  const freq1 = 880; // high A
  const freq2 = 760; // slightly lower

  // Alternate between frequencies
  osc1.frequency.setValueAtTime(freq1, now);
  osc1.frequency.setValueAtTime(freq2, now + 0.1);
  osc1.frequency.setValueAtTime(freq1, now + 0.2);
  osc1.frequency.setValueAtTime(freq2, now + 0.3);
  osc1.frequency.setValueAtTime(freq1, now + 0.4);

  osc2.frequency.setValueAtTime(freq2, now);
  osc2.frequency.setValueAtTime(freq1, now + 0.1);
  osc2.frequency.setValueAtTime(freq2, now + 0.2);
  osc2.frequency.setValueAtTime(freq1, now + 0.3);
  osc2.frequency.setValueAtTime(freq2, now + 0.4);

  // Volume envelope for "boop-boop" effect
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
  gain.gain.setValueAtTime(0.15, now + 0.1);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.15);
  gain.gain.setValueAtTime(0.15, now + 0.2);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.25);
  gain.gain.setValueAtTime(0.15, now + 0.3);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.35);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  // Connect everything
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(audioCtx.destination);

  // Play the sound
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}

// Auto-start if configured
if (AUTO_START) {
  // update initial status and request microphone immediately
  setStatus('starting');
  // start after a short timeout to allow the page to render
  setTimeout(() => startMonitoring(), 100);
} else {
  setStatus('idle');
}
