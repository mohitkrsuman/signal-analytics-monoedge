export const MILL_ID = "RM-01";
export const REPLAY_SEED = 20261019;

export const REPLAY_START = "2026-10-19T10:00:00.000Z";
export const LOAD_STEP_START = "2026-10-19T10:04:00.000Z";
export const LOAD_STEP_END = "2026-10-19T10:06:00.000Z";
export const COBBLE_START = "2026-10-19T10:06:30.000Z";

const SAMPLE_MS = 20;
const REPLAY_MS = 10 * 60 * 1000;

export const SAMPLES_PER_SECOND = 1000 / SAMPLE_MS;
export const BATCH_COUNT = REPLAY_MS / 1000;

const LOAD_RAMP_MS = 5_000;
const COBBLE_MS = 8_000;
const COBBLE_ATTACK_MS = 200;
const COBBLE_RECOVERY_MS = 2_000;

const REPLAY_START_MS = Date.parse(REPLAY_START);
const LOAD_STEP_START_MS = Date.parse(LOAD_STEP_START);
const COBBLE_START_MS = Date.parse(COBBLE_START);

export const SIGNALS = [
  { key: "motor_current", unit: "A", baseline: 120, step: 28, noise: 1.2, digits: 2 },
  { key: "motor_speed", unit: "rpm", baseline: 100, step: 8, noise: 0.35, digits: 2 },
  { key: "torque", unit: "Nm", baseline: 62_000, step: 9_000, noise: 250, digits: 1 },
  { key: "vibration", unit: "mm/s", baseline: 2.2, step: 0, noise: 0.15, digits: 3 },
  { key: "rolling_force", unit: "kN", baseline: 820, step: 140, noise: 8, digits: 1 },
  { key: "temperature", unit: "C", baseline: 650.4, step: 0, noise: 0.04, digits: 3 },
] as const;

export type SignalKey = (typeof SIGNALS)[number]["key"];

export type Sample = {
  signal: SignalKey;
  timestamp: string;
  value: number;
  unit: string;
};

export type Batch = {
  mill_id: typeof MILL_ID;
  samples: Sample[];
};

function nextRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sampleSeed(sampleIndex: number, signalIndex: number): number {
  let hash = Math.imul(REPLAY_SEED ^ sampleIndex, 0x9e3779b1);
  hash = Math.imul(hash ^ (signalIndex + 1), 0x85ebca6b);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return hash >>> 0;
}

function unitNoise(sampleIndex: number, signalIndex: number): number {
  const next = nextRandom(sampleSeed(sampleIndex, signalIndex));
  return next() - 0.5;
}

function smoothstep(amount: number): number {
  return Math.min(1, Math.max(0, amount));
}

function loadLevel(timestampMs: number): number {
  if (timestampMs < LOAD_STEP_START_MS) return 0;
  return smoothstep((timestampMs - LOAD_STEP_START_MS) / LOAD_RAMP_MS);
}

function cobbleLevel(timestampMs: number): number {
  const elapsed = timestampMs - COBBLE_START_MS;
  if (elapsed < 0 || elapsed >= COBBLE_MS + COBBLE_RECOVERY_MS) return 0;
  if (elapsed < COBBLE_ATTACK_MS) return smoothstep(elapsed / COBBLE_ATTACK_MS);
  if (elapsed < COBBLE_MS) return 1;
  return 1 - smoothstep((elapsed - COBBLE_MS) / COBBLE_RECOVERY_MS);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sampleValue(signalIndex: number, sampleIndex: number, timestampMs: number): number {
  const signal = SIGNALS[signalIndex];
  const level = loadLevel(timestampMs);
  const cobble = cobbleLevel(timestampMs);
  let noise = unitNoise(sampleIndex, signalIndex) * signal.noise;
  if (signal.key === "torque") noise *= 1 + cobble * 30;

  if (signal.key === "temperature") {
    const drift = 0.55 * Math.sin((2 * Math.PI * (timestampMs - REPLAY_START_MS)) / 240_000);
    return roundTo(signal.baseline + drift + noise, signal.digits);
  }

  const shift =
    signal.key === "motor_current" ? 190
    : signal.key === "motor_speed" ? -42
    : signal.key === "vibration" ? 12
    : signal.key === "rolling_force" ? -480
    : 0;
  const wobble = signal.key === "torque" ? Math.sin(sampleIndex * 1.7) * cobble * 8_000 : 0;
  return roundTo(signal.baseline + signal.step * level + cobble * shift + noise + wobble, signal.digits);
}

export function generateBatch(batchIndex: number): Batch {
  if (batchIndex < 0 || batchIndex >= BATCH_COUNT) {
    throw new Error(`Batch ${batchIndex} is outside the 10-minute replay`);
  }

  const samples: Sample[] = [];
  for (let offset = 0; offset < SAMPLES_PER_SECOND; offset += 1) {
    const sampleIndex = batchIndex * SAMPLES_PER_SECOND + offset;
    const timestampMs = REPLAY_START_MS + sampleIndex * SAMPLE_MS;
    const timestamp = new Date(timestampMs).toISOString();
    for (let signalIndex = 0; signalIndex < SIGNALS.length; signalIndex += 1) {
      const signal = SIGNALS[signalIndex];
      samples.push({
        signal: signal.key,
        timestamp,
        value: sampleValue(signalIndex, sampleIndex, timestampMs),
        unit: signal.unit,
      });
    }
  }

  return { mill_id: MILL_ID, samples };
}
