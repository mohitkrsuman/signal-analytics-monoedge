// Ingest calls detect() after each saved second. It writes at most one alert per incident.
// The short version of these rules is lib/detection.md.

import { alertContext, type AlertContext, type SignalEvidence } from "@/lib/monitor";

const LOOKBACK_MS = 3 * 60 * 1000;
const RECENT_MS = 20 * 1000;
const WINDOW_MS = 2 * 1000;
const Z_ALERT = 3;
const Z_COBBLE = 6;
const SETTLE_MS = 3 * 1000;
const MIN_LONG = 30;
const MIN_RECENT = 15;

const SIGNALS = [
  "motor_current",
  "motor_speed",
  "torque",
  "vibration",
  "rolling_force",
  "temperature",
] as const;

const LOAD = ["motor_current", "motor_speed", "torque", "rolling_force"] as const;
const COBBLE_UP = ["motor_current", "vibration"] as const;
const COBBLE_DOWN = ["motor_speed", "rolling_force"] as const;
const LOAD_SET = new Set<string>(LOAD);
const COBBLE_SET = new Set<string>([...COBBLE_UP, ...COBBLE_DOWN]);

const LABELS: Record<string, string> = {
  motor_current: "Motor current",
  motor_speed: "Motor speed",
  torque: "Torque",
  vibration: "Vibration",
  rolling_force: "Rolling force",
  temperature: "Temperature",
};

type Level = { center: number; scale: number };
type Point = { avg: number; min: number; max: number };
type Series = Map<string, Map<number, Point>>;
type Levels = Map<string, { long: Level; recent: Level | null }>;

type Reading = {
  cobble: boolean;
  fault: boolean;
  hot: string[];
  evidence: Record<string, SignalEvidence>;
};

type RollupRow = {
  signal: string;
  bucket_start: string;
  avg: number;
  min: number;
  max: number;
  stddev: number;
};

type StoredAlert = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  severity: string;
  reason: string;
  signals: string[];
  detector: string;
  score: number;
  context: AlertContext | null;
};

type Draft = {
  started_at: string;
  ended_at: string | null;
  severity: "warning" | "critical";
  reason: string;
  signals: string[];
  detector: "rule" | "zscore";
  score: number;
  context: AlertContext;
};

type Action = { op: "insert"; draft: Draft } | { op: "update"; id: string; draft: Draft };

export async function detect(millId: string, _from: string, to: string) {
  const endMs = Math.floor(Date.parse(to) / 1000) * 1000; // to get in ms
  if (!Number.isFinite(endMs)) return;

  const { createAdminClient } = await import("@/utils/supabase/admin");
  const admin = createAdminClient();
  const since = new Date(endMs - LOOKBACK_MS - RECENT_MS).toISOString();
  const until = new Date(endMs).toISOString();
  const [rollups, alerts] = await Promise.all([
    loadRollups(admin, millId, since, until),
    loadAlerts(admin, millId, endMs),
  ]);

  for (const action of decide(until, rollups, alerts)) {
    const write =
      action.op === "insert"
        ? admin.from("alerts").insert({ mill_id: millId, ...action.draft })
        : admin.from("alerts").update(action.draft).eq("id", action.id);
    const { error } = await write;
    if (error) throw new Error(error.message);
  }
}

function decide(bucketIso: string, rollups: RollupRow[], alerts: StoredAlert[]): Action[] {
  const t = Math.floor(Date.parse(bucketIso) / 1000) * 1000;
  if (!Number.isFinite(t)) return [];

  const series = group(rollups.filter((row) => Date.parse(row.bucket_start) <= t));
  const now = readSecond(series, alerts, t);
  if (!now) return [];

  const open = alerts.find((alert) => alert.endedAt === null);
  if (!open) return openAlert(series, alerts, t, now);

  const through = throughMs(open);
  const still = stillGoing(open, now);
  if (t - through > SETTLE_MS && still) {
    const others = alerts.filter((alert) => alert.id !== open.id);
    return [closeAlert(open, through), ...openAlert(series, others, t, now)];
  }
  if (still) return [extendAlert(open, t, now)];
  if (t - through >= SETTLE_MS) return [closeAlert(open, through)];
  return [];
}

function openAlert(series: Series, alerts: StoredAlert[], t: number, now: Reading): Action[] {
  const prev = readSecond(series, alerts, t - 1000);
  const prev2 = readSecond(series, alerts, t - 2000);
  const zSignals = now.hot.filter((key) => prev?.hot.includes(key) && prev2?.hot.includes(key));
  if (!now.cobble && zSignals.length === 0) return [];

  const start = now.cobble ? (prev?.fault ? t - 1000 : t) : t - 2000;
  const draft = buildDraft(start, t, now, now.cobble, zSignals, null);
  const covering = alerts.find((alert) => sameIncident(alert, start, t));
  if (!covering) return [{ op: "insert", draft }];
  return [{ op: "update", id: covering.id, draft: { ...draft, started_at: covering.startedAt } }];
}

function extendAlert(alert: StoredAlert, t: number, now: Reading): Action {
  const cobble = now.cobble || alert.detector === "rule";
  return {
    op: "update",
    id: alert.id,
    draft: { ...buildDraft(Date.parse(alert.startedAt), t, now, cobble, now.hot, alert), started_at: alert.startedAt },
  };
}

function closeAlert(alert: StoredAlert, through: number): Action {
  return {
    op: "update",
    id: alert.id,
    draft: {
      started_at: alert.startedAt,
      ended_at: new Date(through + 1000).toISOString(),
      severity: alert.severity === "warning" ? "warning" : "critical",
      reason: alert.reason,
      signals: alert.signals,
      detector: alert.detector === "zscore" ? "zscore" : "rule",
      score: alert.score,
      context: alert.context ?? { through: new Date(through).toISOString(), checks: [], signals: {} },
    },
  };
}

function buildDraft(
  start: number,
  t: number,
  now: Reading,
  cobble: boolean,
  zSignals: string[],
  existing: StoredAlert | null,
): Draft {
  const signals = cobble ? [...COBBLE_UP, ...COBBLE_DOWN] : inOrder(zSignals.length > 0 ? zSignals : existing?.signals ?? []);
  return {
    started_at: new Date(start).toISOString(),
    ended_at: null,
    severity: cobble ? "critical" : "warning",
    reason: cobble ? cobbleReason() : zReason(signals, now.evidence),
    signals,
    detector: cobble ? "rule" : "zscore",
    score: round(Math.max(0, ...signals.map((key) => Math.abs(now.evidence[key]?.z ?? 0)))),
    context: {
      through: new Date(t).toISOString(),
      checks: [...(cobble ? ["cobble"] : []), ...(zSignals.length > 0 ? ["zscore"] : [])],
      signals: now.evidence,
    },
  };
}

function stillGoing(alert: StoredAlert, now: Reading) {
  const tracked = alert.detector === "rule" ? COBBLE_SET : new Set(alert.signals);
  return now.cobble || now.hot.some((key) => tracked.has(key));
}

function readSecond(series: Series, alerts: StoredAlert[], t: number): Reading | null {
  const levels: Levels = new Map();
  for (const key of SIGNALS) {
    const buckets = series.get(key);
    if (!buckets?.has(t)) return null;
    const long = levelOf(samples(buckets, t - LOOKBACK_MS, t - WINDOW_MS, alerts), MIN_LONG);
    if (!long) return null;
    levels.set(key, { long, recent: levelOf(samples(buckets, t - RECENT_MS, t - WINDOW_MS, alerts), MIN_RECENT) });
  }

  const shifted = loadShifted(levels);
  const evidence: Record<string, SignalEvidence> = {};
  for (const key of SIGNALS) {
    const basis = basisOf(levels, key, shifted);
    const latest = series.get(key)?.get(t)?.avg ?? 0;
    if (!basis) return null;
    evidence[key] = {
      baseline: round(basis.center),
      stddev: round(basis.scale),
      latest: round(latest),
      direction: latest - basis.center > basis.scale ? "up" : basis.center - latest > basis.scale ? "down" : "steady",
      z: round((latest - basis.center) / basis.scale),
    };
  }

  const operating = loadMovingTogether(evidence);
  const fault = zExtreme(series, levels, shifted, "motor_current", t, "max") > Z_COBBLE
    && zExtreme(series, levels, shifted, "motor_speed", t, "min") < -Z_COBBLE;
  return {
    cobble: fault && windowCobble(series, levels, shifted, t),
    fault,
    hot: SIGNALS.filter((key) => Math.abs(evidence[key]?.z ?? 0) > Z_ALERT && !(operating && LOAD_SET.has(key))),
    evidence,
  };
}

function loadShifted(levels: Levels) {
  const load = LOAD.map((key) => levels.get(key));
  if (load.some((item) => !item?.recent)) return false;
  const shifts = load.map((item) => item!.recent!.center - item!.long.center);
  const sameWay = shifts.every((shift) => shift > 0) || shifts.every((shift) => shift < 0);
  const moved = load.every((item) => Math.abs(item!.recent!.center - item!.long.center) > Z_COBBLE * item!.long.scale);
  const stable = load.every((item) => item!.recent!.scale <= item!.long.scale * 4);
  const vibration = levels.get("vibration");
  const calm = vibration?.recent != null && Math.abs(vibration.recent.center - vibration.long.center) < Z_ALERT * vibration.long.scale;
  return sameWay && moved && stable && calm;
}

function loadMovingTogether(evidence: Record<string, SignalEvidence>) {
  const zs = LOAD.map((key) => evidence[key]?.z ?? 0);
  const sameWay = zs.every((z) => z > Z_ALERT) || zs.every((z) => z < -Z_ALERT);
  return sameWay && Math.abs(evidence.vibration?.z ?? 0) < Z_ALERT;
}

function windowCobble(series: Series, levels: Levels, shifted: boolean, t: number) {
  const above = COBBLE_UP.every((key) => windowExtreme(series, levels, shifted, key, t, "max") > Z_COBBLE);
  const below = COBBLE_DOWN.every((key) => windowExtreme(series, levels, shifted, key, t, "min") < -Z_COBBLE);
  return above && below;
}

function windowExtreme(series: Series, levels: Levels, shifted: boolean, key: string, t: number, side: "min" | "max") {
  if (!series.get(key)?.get(t) || !series.get(key)?.get(t - 1000)) return 0;
  const now = zExtreme(series, levels, shifted, key, t, side);
  const prev = zExtreme(series, levels, shifted, key, t - 1000, side);
  return side === "max" ? Math.max(now, prev) : Math.min(now, prev);
}

function zExtreme(series: Series, levels: Levels, shifted: boolean, key: string, t: number, side: "min" | "max") {
  const point = series.get(key)?.get(t);
  const basis = basisOf(levels, key, shifted);
  if (!point || !basis) return 0;
  return (point[side] - basis.center) / basis.scale;
}

function basisOf(levels: Levels, key: string, shifted: boolean) {
  const chosen = levels.get(key);
  if (!chosen) return null;
  return shifted && chosen.recent ? chosen.recent : chosen.long;
}

function samples(buckets: Map<number, Point>, from: number, to: number, alerts: StoredAlert[]) {
  const found: number[] = [];
  for (const [time, point] of buckets) {
    if (time < from || time >= to || insideAlert(time, alerts)) continue;
    found.push(point.avg);
  }
  return found;
}

function insideAlert(time: number, alerts: StoredAlert[]) {
  return alerts.some((alert) => {
    const start = Date.parse(alert.startedAt);
    const end = alert.endedAt ? Date.parse(alert.endedAt) : throughMs(alert) + 1000;
    return time >= start && time < end;
  });
}

function sameIncident(alert: StoredAlert, start: number, t: number) {
  const opened = Date.parse(alert.startedAt);
  const closed = alert.endedAt ? Date.parse(alert.endedAt) : throughMs(alert) + 1000;
  return Math.abs(opened - start) <= WINDOW_MS || (t >= opened && t < closed + SETTLE_MS);
}

function throughMs(alert: StoredAlert) {
  const parsed = alert.context?.through ? Date.parse(alert.context.through) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Date.parse(alert.endedAt ?? alert.startedAt);
}

function levelOf(values: number[], minimum: number): Level | null {
  if (values.length < minimum) return null;
  const center = median(values);
  const spread = median(values.map((value) => Math.abs(value - center)));
  const scale = Math.max(1.4826 * spread, Math.abs(center) * 0.0005, 1e-6); // preventing it from being 0
  return { center, scale };
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function cobbleReason() {
  return "Motor current and vibration spiked while motor speed and rolling force dropped.";
}

function zReason(signals: string[], evidence: Record<string, SignalEvidence>) {
  const phrase = (key: string) => `${LABELS[key] ?? key} ${evidence[key]?.direction === "down" ? "dropped" : "rose"}`;
  if (signals.length === 1) {
    return `${phrase(signals[0])} and stayed beyond 3 standard deviations from its recent baseline.`;
  }
  const parts = signals.map(phrase);
  const body = parts.length === 2 ? parts.join(" and ") : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return `${body}, and each stayed beyond 3 standard deviations from its recent baseline.`;
}

function inOrder(keys: string[]) {
  return SIGNALS.filter((key) => keys.includes(key));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function group(rows: RollupRow[]) {
  const series: Series = new Map();
  for (const row of rows) {
    const time = Date.parse(row.bucket_start);
    if (!Number.isFinite(time)) continue;
    const buckets = series.get(row.signal) ?? new Map<number, Point>();
    buckets.set(time, { avg: row.avg, min: row.min, max: row.max });
    series.set(row.signal, buckets);
  }
  return series;
}

type Admin = Awaited<ReturnType<typeof import("@/utils/supabase/admin").createAdminClient>>;

async function loadRollups(admin: Admin, millId: string, since: string, until: string) {
  // The window is about 1,200 rows, so fetch the first two pages together. More pages follow only if needed.
  const page = (offset: number) =>
    admin
      .from("rollups")
      .select("signal, bucket_start, avg, min, max, stddev")
      .eq("mill_id", millId)
      .gte("bucket_start", since)
      .lte("bucket_start", until)
      .order("bucket_start", { ascending: true })
      .order("signal", { ascending: true })
      .range(offset, offset + 999);

  const rows: RollupRow[] = [];
  const pages = await Promise.all([page(0), page(1000)]);
  for (let offset = 2000; ; offset += 1000) {
    for (const { data, error } of pages) {
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
    }
    const last = pages[pages.length - 1].data ?? [];
    if (last.length < 1000 || offset >= 5000) break;
    pages.splice(0, pages.length, await page(offset));
  }
  return rows;
}

async function loadAlerts(admin: Admin, millId: string, endMs: number) {
  const { data, error } = await admin
    .from("alerts")
    .select("id, started_at, ended_at, severity, reason, signals, detector, score, context")
    .eq("mill_id", millId)
    .gte("started_at", new Date(endMs - 20 * 60 * 1000).toISOString())
    .order("started_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    severity: row.severity,
    reason: row.reason,
    signals: row.signals,
    detector: row.detector,
    score: row.score,
    context: alertContext(row.context),
  }));
}