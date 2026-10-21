// Preview of the seeded 10-minute replay. Phase 06 replaces this module
// with the Query API. The shapes match the live, history, and alert screens.

export const MILL_ID = "RM-01";

export const SIGNALS = [
  { key: "motor_current", label: "Motor current", unit: "A" },
  { key: "motor_speed", label: "Motor speed", unit: "rpm" },
  { key: "torque", label: "Torque", unit: "Nm" },
  { key: "vibration", label: "Vibration", unit: "mm/s" },
  { key: "rolling_force", label: "Rolling force", unit: "kN" },
  { key: "temperature", label: "Temperature", unit: "C" },
] as const;

export type SignalKey = (typeof SIGNALS)[number]["key"];

export type RollupPoint = {
  bucketStart: string;
  t: number;
  min: number;
  max: number;
  avg: number;
};

export type PreviewAlert = {
  id: string;
  millId: string;
  startedAt: string;
  endedAt: string;
  severity: "critical" | "warning";
  detector: "rule" | "zscore";
  score: number;
  signals: SignalKey[];
  reason: string;
};

export const REPLAY_START = Date.parse("2026-10-19T10:00:00.000Z");
const REPLAY_SECONDS = 10 * 60;
const LOAD_START = 4 * 60;
const LOAD_RAMP_SECONDS = 20;
const COBBLE_START = 6 * 60 + 30;
const COBBLE_SECONDS = 8;

export const COBBLE_ALERT: PreviewAlert = {
  id: "cobble-rm-01",
  millId: MILL_ID,
  startedAt: new Date(REPLAY_START + COBBLE_START * 1000).toISOString(),
  endedAt: new Date(
    REPLAY_START + (COBBLE_START + COBBLE_SECONDS) * 1000,
  ).toISOString(),
  severity: "critical",
  detector: "rule",
  score: 6.4,
  signals: ["motor_current", "vibration", "motor_speed", "rolling_force"],
  reason:
    "Motor current and vibration spiked while motor speed and rolling force dropped. Treated as a cobble.",
};

export const HISTORY_RANGES = {
  replay: {
    label: "Full replay",
    from: REPLAY_START,
    to: REPLAY_START + REPLAY_SECONDS * 1000,
  },
  load: {
    label: "Load step",
    from: Date.parse("2026-10-19T10:03:30.000Z"),
    to: Date.parse("2026-10-19T10:06:30.000Z"),
  },
  cobble: {
    label: "Cobble",
    from: Date.parse("2026-10-19T10:06:00.000Z"),
    to: Date.parse("2026-10-19T10:07:30.000Z"),
  },
} as const;

export type HistoryRangeKey = keyof typeof HISTORY_RANGES;

const LIVE_WINDOW_MS = 4 * 60 * 1000;

const BANDS: Record<
  SignalKey,
  { normal: number; load: number; cobble: number; spread: number }
> = {
  motor_current: { normal: 124, load: 168, cobble: 310, spread: 3 },
  motor_speed: { normal: 540, load: 690, cobble: 150, spread: 6 },
  torque: { normal: 2100, load: 2780, cobble: 1600, spread: 40 },
  vibration: { normal: 1.6, load: 1.7, cobble: 12.4, spread: 0.15 },
  rolling_force: { normal: 980, load: 1340, cobble: 220, spread: 18 },
  temperature: { normal: 68.4, load: 69.1, cobble: 69.2, spread: 0.08 },
};

function loadMix(second: number) {
  if (second < LOAD_START) return 0;
  if (second >= LOAD_START + LOAD_RAMP_SECONDS) return 1;
  const x = (second - LOAD_START) / LOAD_RAMP_SECONDS;
  return x * x * (3 - 2 * x);
}

function cobbleMix(second: number) {
  const elapsed = second - COBBLE_START;
  if (elapsed < 0 || elapsed >= COBBLE_SECONDS) return 0;
  if (elapsed < 1) return elapsed;
  if (elapsed > COBBLE_SECONDS - 1) return COBBLE_SECONDS - elapsed;
  return 1;
}

function wobble(second: number, salt: number) {
  return (
    Math.sin(second * 0.35 + salt) * 0.65 +
    Math.sin(second * 0.07 + salt * 1.7) * 0.35
  );
}

function average(key: SignalKey, second: number) {
  const band = BANDS[key];
  const fault = cobbleMix(second);
  if (key === "temperature") {
    return band.normal + second * 0.004 + fault * 0.15 + wobble(second, 1) * 0.04;
  }

  const level = band.normal + (band.load - band.normal) * loadMix(second);
  let value = level + (band.cobble - level) * fault;
  if (key === "torque" && fault > 0) {
    value += Math.sin(second * 2.4) * 700 * fault;
  }
  return value + wobble(second, key.length) * band.spread * 0.35;
}

function point(key: SignalKey, second: number): RollupPoint {
  const avg = average(key, second);
  const fault = cobbleMix(second);
  const spread =
    BANDS[key].spread * (1 + fault * (key === "torque" ? 4 : 1.5));
  const t = REPLAY_START + second * 1000;
  return {
    t,
    bucketStart: new Date(t).toISOString(),
    avg,
    min: avg - spread,
    max: avg + spread,
  };
}

const series = new Map<SignalKey, RollupPoint[]>(
  SIGNALS.map((signal) => {
    const points: RollupPoint[] = [];
    for (let second = 0; second < REPLAY_SECONDS; second += 1) {
      points.push(point(signal.key, second));
    }
    return [signal.key, points];
  }),
);

export function signalByKey(key: string | undefined) {
  return SIGNALS.find((signal) => signal.key === key) ?? SIGNALS[0];
}

export function isSignalKey(key: string | undefined): key is SignalKey {
  return SIGNALS.some((signal) => signal.key === key);
}

export function rollups(key: SignalKey, from: number, to: number) {
  return (series.get(key) ?? []).filter((point) => point.t >= from && point.t < to);
}

export function latest(key: SignalKey) {
  const points = series.get(key) ?? [];
  return points[points.length - 1];
}

export function liveRollups(key: SignalKey) {
  const end = REPLAY_START + REPLAY_SECONDS * 1000;
  return rollups(key, end - LIVE_WINDOW_MS, end);
}

export function millStatus(): "normal" | "alert" {
  const open = alerts().some((alert) => Date.parse(alert.endedAt) > replayEnd());
  return open ? "alert" : "normal";
}

export function alerts() {
  return [COBBLE_ALERT];
}

export function alertById(id: string) {
  return alerts().find((alert) => alert.id === id) ?? null;
}

export function incidentWindow(alert: PreviewAlert) {
  return {
    from: Date.parse(alert.startedAt) - 30_000,
    to: Date.parse(alert.endedAt) + 30_000,
  };
}

export function historyRange(key: string | undefined) {
  if (key && key in HISTORY_RANGES) {
    return HISTORY_RANGES[key as HistoryRangeKey];
  }
  return HISTORY_RANGES.replay;
}

export function formatClock(ms: number) {
  return `${new Date(ms).toISOString().slice(11, 19)} UTC`;
}

export function formatValue(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function replayEnd() {
  return REPLAY_START + (REPLAY_SECONDS - 1) * 1000;
}
