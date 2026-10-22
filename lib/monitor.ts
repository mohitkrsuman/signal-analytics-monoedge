export const MILL_ID = "RM-01";
export const LIVE_WINDOW_MINUTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const DEFAULT_LIVE_MINUTES = 4;
export const LIVE_WINDOW_MS = DEFAULT_LIVE_MINUTES * 60 * 1000;

export function liveWindowMinutes(value: string | undefined) {
  const minutes = Number(value);
  return (LIVE_WINDOW_MINUTES as readonly number[]).includes(minutes) ? minutes : DEFAULT_LIVE_MINUTES;
}

export const HISTORY_RANGES = {
  replay: {
    label: "Full replay",
    from: Date.parse("2026-10-19T10:00:00.000Z"),
    to: Date.parse("2026-10-19T10:10:00.000Z"),
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

export type RollupPoint = {
  bucketStart: string;
  t: number;
  min: number;
  max: number;
  avg: number;
};

export type AlertSummary = {
  id: string;
  millId: string;
  startedAt: string;
  endedAt: string | null;
  severity: string;
  detector: string;
  score: number;
  signals: string[];
  reason: string;
};

export type SignalEvidence = {
  baseline: number;
  stddev: number;
  latest: number;
  direction: "up" | "down" | "steady";
  z: number;
};

export type AlertContext = {
  through: string;
  checks: string[];
  signals: Record<string, SignalEvidence>;
};

export function alertContext(value: unknown): AlertContext | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { through?: unknown; checks?: unknown; signals?: unknown };
  if (!record.signals || typeof record.signals !== "object") return null;

  const signals: Record<string, SignalEvidence> = {};
  for (const [key, raw] of Object.entries(record.signals)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<SignalEvidence>;
    if (typeof item.baseline !== "number" || typeof item.latest !== "number") continue;
    signals[key] = {
      baseline: item.baseline,
      stddev: typeof item.stddev === "number" ? item.stddev : 0,
      latest: item.latest,
      direction: item.direction === "up" || item.direction === "down" ? item.direction : "steady",
      z: typeof item.z === "number" ? item.z : 0,
    };
  }

  return {
    through: typeof record.through === "string" ? record.through : "",
    checks: Array.isArray(record.checks) ? record.checks.filter((item) => typeof item === "string") : [],
    signals,
  };
}

export type LiveSignal = {
  key: string;
  label: string;
  unit: string;
  value: number | null;
  timestamp: string | null;
  rollups: RollupPoint[];
};

export type LiveSnapshot = {
  millId: string;
  status: "normal" | "alert";
  window: { from: number; to: number } | null;
  signals: LiveSignal[];
  alerts: AlertSummary[];
};

export function historyRange(key: string | undefined) {
  if (key && key in HISTORY_RANGES) return HISTORY_RANGES[key as HistoryRangeKey];
  return HISTORY_RANGES.replay;
}

export function toPoint(
  bucketStart: string,
  min: number,
  max: number,
  avg: number,
): RollupPoint {
  return { bucketStart, t: Date.parse(bucketStart), min, max, avg };
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

export function signalLabel(
  signals: { key: string; label: string }[],
  key: string,
) {
  return signals.find((signal) => signal.key === key)?.label ?? key;
}

export function liveFromWire(body: {
  mill_id: string;
  status: "normal" | "alert";
  window: { from: number; to: number } | null;
  signals: {
    key: string;
    label: string;
    unit: string;
    value: number | null;
    timestamp: string | null;
    rollups: { bucket_start: string; min: number; max: number; avg: number }[];
  }[];
  alerts: {
    id: string;
    mill_id: string;
    started_at: string;
    ended_at: string | null;
    severity: string;
    detector: string;
    score: number;
    signals: string[];
    reason: string;
  }[];
}): LiveSnapshot {
  return {
    millId: body.mill_id,
    status: body.status,
    window: body.window,
    signals: body.signals.map((signal) => ({
      key: signal.key,
      label: signal.label,
      unit: signal.unit,
      value: signal.value,
      timestamp: signal.timestamp,
      rollups: signal.rollups.map((point) =>
        toPoint(point.bucket_start, point.min, point.max, point.avg),
      ),
    })),
    alerts: body.alerts.map((alert) => ({
      id: alert.id,
      millId: alert.mill_id,
      startedAt: alert.started_at,
      endedAt: alert.ended_at,
      severity: alert.severity,
      detector: alert.detector,
      score: alert.score,
      signals: alert.signals,
      reason: alert.reason,
    })),
  };
}

export function mergeLive(current: LiveSnapshot, update: LiveSnapshot, windowMs = LIVE_WINDOW_MS): LiveSnapshot {
  let end = Number.NEGATIVE_INFINITY;
  const signals = current.signals.map((signal) => {
    const next = update.signals.find((item) => item.key === signal.key);
    const byBucket = new Map(signal.rollups.map((point) => [point.bucketStart, point]));
    for (const point of next?.rollups ?? []) byBucket.set(point.bucketStart, point);
    const rollups = [...byBucket.values()].sort((left, right) => left.t - right.t);
    const last = rollups.at(-1)?.t;
    if (last !== undefined && last > end) end = last;
    return {
      ...signal,
      label: next?.label || signal.label,
      unit: next?.unit || signal.unit,
      value: next?.value ?? signal.value,
      timestamp: next?.timestamp ?? signal.timestamp,
      rollups,
    };
  });

  const trimmed =
    end === Number.NEGATIVE_INFINITY
      ? signals
      : signals.map((signal) => ({
          ...signal,
          rollups: signal.rollups.filter((point) => point.t >= end - windowMs),
        }));

  return {
    millId: update.millId,
    status: update.status,
    window: end === Number.NEGATIVE_INFINITY ? current.window : { from: end - windowMs, to: end },
    signals: trimmed,
    alerts: update.alerts,
  };
}

export function overlappingAlert(alerts: AlertSummary[], from: number, to: number) {
  return (
    alerts.find((alert) => {
      const start = Date.parse(alert.startedAt);
      const end = alert.endedAt ? Date.parse(alert.endedAt) : start;
      return end > from && start < to;
    }) ?? null
  );
}
