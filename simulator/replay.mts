// Builds raw samples. No files and no HTTP.
// value = baseline + load step after 10:04 + cobble jump during an 8s window + small noise.

export const MILL_ID = "RM-01";
export const REPLAY_SEED = 20261019;
export const REPLAY_START = "2026-10-19T10:00:00.000Z";
export const LOAD_STEP_START = "2026-10-19T10:04:00.000Z";
export const LOAD_STEP_END = "2026-10-19T10:06:00.000Z";
export const COBBLE_STARTS = [
  "2026-10-19T10:06:30.000Z",
  "2026-10-19T10:08:30.000Z",
] as const;

const SAMPLE_MS = 20;
const REPLAY_MS = 10 * 60 * 1000;
const COBBLE_MS = 8_000;
const REPLAY_START_MS = Date.parse(REPLAY_START);
const LOAD_STEP_START_MS = Date.parse(LOAD_STEP_START);

export const SAMPLES_PER_SECOND = 1000 / SAMPLE_MS;
export const BATCH_COUNT = REPLAY_MS / 1000;

const COBBLES = [
  { startMs: Date.parse(COBBLE_STARTS[0]), current: 210, vibration: 8, speed: -48, force: -510, jitter: 36 },
  { startMs: Date.parse(COBBLE_STARTS[1]), current: 120, vibration: 17, speed: -26, force: -340, jitter: 14 },
];

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

function noise(sampleIndex: number, signalIndex: number): number {
  let state = (REPLAY_SEED + sampleIndex * 10 + signalIndex) >>> 0;
  state = (Math.imul(1664525, state) + 1013904223) >>> 0;
  return state / 4294967296 - 0.5;
}

function cobbleAt(timestampMs: number) {
  return COBBLES.find((cobble) => {
    const elapsed = timestampMs - cobble.startMs;
    return elapsed >= 0 && elapsed < COBBLE_MS;
  });
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sampleValue(signalIndex: number, sampleIndex: number, timestampMs: number): number {
  const signal = SIGNALS[signalIndex];
  const onLoad = timestampMs >= LOAD_STEP_START_MS;
  const cobble = cobbleAt(timestampMs);
  let value = signal.baseline + (onLoad ? signal.step : 0);
  value += noise(sampleIndex, signalIndex) * signal.noise;

  if (signal.key === "temperature") {
    value += 0.55 * Math.sin((2 * Math.PI * (timestampMs - REPLAY_START_MS)) / 240_000);
  } else if (cobble) {
    const jump = {
      motor_current: cobble.current,
      motor_speed: cobble.speed,
      torque: 0,
      vibration: cobble.vibration,
      rolling_force: cobble.force,
      temperature: 0,
    }[signal.key];
    value += jump;
    if (signal.key === "torque") value += noise(sampleIndex, signalIndex + 7) * 8_000;
    if (signal.key === "motor_current" || signal.key === "vibration") {
      value += noise(sampleIndex, signalIndex + 6) * cobble.jitter;
    }
  }

  return roundTo(value, signal.digits);
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
