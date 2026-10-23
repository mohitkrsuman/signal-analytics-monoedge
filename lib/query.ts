import { connection } from "next/server";
import { recentIngestEnd } from "@/lib/ingest-head";
import { createClient } from "@/utils/supabase/server";
import {
  alertContext,
  type AlertContext,
  type AlertSummary,
  LIVE_WINDOW_MS,
  type LiveSnapshot,
  type RollupPoint,
  toPoint,
} from "@/lib/monitor";

const SIGNAL_ORDER = [
  "motor_current",
  "motor_speed",
  "torque",
  "vibration",
  "rolling_force",
  "temperature",
];

const MAX_HISTORY_MS = 2 * 60 * 60 * 1000;
const MAX_RAW_MS = 2 * 60 * 1000;
const MAX_POINTS = 900;

export type SignalInfo = { key: string; label: string; unit: string };
export type MillInfo = { id: string; displayName: string; signals: SignalInfo[] };

type Db = Awaited<ReturnType<typeof createClient>>;
type Page<T> = { data: T[] | null; error: { message: string } | null };

export async function getSessionClient() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return supabase;
}

export async function getMills(supabase: Db): Promise<MillInfo[]> {
  const mills = await supabase.from("mills").select("id, display_name").order("id");
  if (mills.error) throw new Error(mills.error.message);
  const signals = await supabase.from("signals").select("mill_id, signal, unit, label");
  if (signals.error) throw new Error(signals.error.message);

  return (mills.data ?? []).map((mill) => ({
    id: mill.id,
    displayName: mill.display_name,
    signals: sortSignals(
      (signals.data ?? [])
        .filter((row) => row.mill_id === mill.id)
        .map((row) => ({ key: row.signal, label: row.label, unit: row.unit })),
    ),
  }));
}

export async function getLive(
  supabase: Db,
  millId: string,
  since?: string | null,
  windowMs = LIVE_WINDOW_MS,
): Promise<LiveSnapshot | null> {
  const mill = await getMills(supabase).then((mills) => mills.find((item) => item.id === millId));
  if (!mill) return null;

  const edge = await supabase
    .from("rollups")
    .select("bucket_start")
    .eq("mill_id", millId)
    .order("bucket_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (edge.error) throw new Error(edge.error.message);

  const storedEnd = edge.data?.bucket_start ?? null;
  const marker = await supabase
    .from("mills")
    .select("ingest_head, updated_at")
    .eq("id", millId)
    .maybeSingle();
  if (marker.error) throw new Error(marker.error.message);
  const touched = marker.data?.updated_at ? Date.parse(marker.data.updated_at) : Number.NaN;
  const freshHead =
    marker.data?.ingest_head && Number.isFinite(touched) && Date.now() - touched < 15_000
      ? marker.data.ingest_head
      : null;
  const writing = freshHead ?? recentIngestEnd(millId);
  const endBucket =
    writing && storedEnd && Date.parse(writing) <= Date.parse(storedEnd) ? writing : storedEnd;

  const latestRows = await supabase
    .from("readings")
    .select("signal, ts, value")
    .eq("mill_id", millId)
    .lte("ts", endBucket ?? new Date().toISOString())
    .order("ts", { ascending: false })
    .limit(24);
  if (latestRows.error) throw new Error(latestRows.error.message);

  const latest = new Map<string, { ts: string; value: number }>();
  for (const row of latestRows.data ?? []) {
    if (!latest.has(row.signal)) latest.set(row.signal, { ts: row.ts, value: row.value });
  }

  let window: LiveSnapshot["window"] = null;
  const rollups = new Map<string, RollupPoint[]>();
  if (endBucket) {
    const endMs = Date.parse(endBucket);
    const windowStart = endMs - windowMs;
    const sinceMs = since ? Date.parse(since) : Number.NaN;
    const incremental = Number.isFinite(sinceMs) && sinceMs >= windowStart && sinceMs < endMs;
    window = { from: incremental ? sinceMs : windowStart, to: endMs };
    const rows = await readPages<{
      signal: string;
      bucket_start: string;
      min: number;
      max: number;
      avg: number;
    }>((from, to) => {
      const query = supabase
        .from("rollups")
        .select("signal, bucket_start, min, max, avg")
        .eq("mill_id", millId)
        .lte("bucket_start", endBucket)
        .order("bucket_start", { ascending: true })
        .order("signal", { ascending: true });
      const bounded = incremental
        ? query.gt("bucket_start", new Date(sinceMs).toISOString())
        : query.gte("bucket_start", new Date(windowStart).toISOString());
      return bounded.range(from, to);
    }, Math.ceil(windowMs / 1000) * mill.signals.length + 1000);
    for (const row of rows) {
      const points = rollups.get(row.signal) ?? [];
      points.push(toPoint(row.bucket_start, row.min, row.max, row.avg));
      rollups.set(row.signal, points);
    }
  }

  const open = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("mill_id", millId)
    .is("ended_at", null);
  if (open.error) throw new Error(open.error.message);

  return {
    millId,
    status: (open.count ?? 0) > 0 ? "alert" : "normal",
    window,
    signals: mill.signals.map((signal) => {
      const current = latest.get(signal.key);
      return {
        ...signal,
        value: current?.value ?? null,
        timestamp: current?.ts ?? null,
        rollups: rollups.get(signal.key) ?? [],
      };
    }),
    alerts: await listAlerts(supabase, millId),
  };
}

export async function getHistory(
  supabase: Db,
  millId: string,
  signal: string,
  fromMs: number,
  toMs: number,
): Promise<{ points: RollupPoint[] } | { error: string; status: 400 | 404 }> {
  const mill = await getMills(supabase).then((mills) => mills.find((item) => item.id === millId));
  if (!mill) return { error: "Unknown mill", status: 404 };
  if (!mill.signals.some((item) => item.key === signal)) {
    return { error: "Unknown signal", status: 400 };
  }
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return { error: "Bad range", status: 400 };
  }
  if (toMs - fromMs > MAX_HISTORY_MS) {
    return { error: "Range exceeds 2 hours", status: 400 };
  }

  const rows = await readPages<{ bucket_start: string; min: number; max: number; avg: number }>(
    (from, to) =>
      supabase
        .from("rollups")
        .select("bucket_start, min, max, avg")
        .eq("mill_id", millId)
        .eq("signal", signal)
        .gte("bucket_start", new Date(fromMs).toISOString())
        .lt("bucket_start", new Date(toMs).toISOString())
        .order("bucket_start", { ascending: true })
        .range(from, to),
    8000,
  );

  let points = rows.map((row) => toPoint(row.bucket_start, row.min, row.max, row.avg));
  if (points.length > MAX_POINTS) {
    const step = Math.ceil(points.length / MAX_POINTS);
    points = points.filter((_, index) => index % step === 0);
  }
  return { points };
}

export async function getRaw(
  supabase: Db,
  millId: string,
  signal: string,
  fromMs: number,
  toMs: number,
): Promise<{ samples: { timestamp: string; value: number }[] } | { error: string; status: 400 | 404 }> {
  const history = await getHistory(supabase, millId, signal, fromMs, toMs);
  if ("error" in history) return history;
  if (toMs - fromMs > MAX_RAW_MS) {
    return { error: "Raw samples are limited to 2 minutes", status: 400 };
  }

  const rows = await readPages<{ ts: string; value: number }>(
    (from, to) =>
      supabase
        .from("readings")
        .select("ts, value")
        .eq("mill_id", millId)
        .eq("signal", signal)
        .gte("ts", new Date(fromMs).toISOString())
        .lt("ts", new Date(toMs).toISOString())
        .order("ts", { ascending: true })
        .range(from, to),
    8000,
  );
  return { samples: rows.map((row) => ({ timestamp: row.ts, value: row.value })) };
}

export async function listAlerts(supabase: Db, millId: string): Promise<AlertSummary[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("id, mill_id, started_at, ended_at, severity, reason, signals, detector, score")
    .eq("mill_id", millId)
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAlert);
}

export async function getAlert(supabase: Db, id: string) {
  const { data, error } = await supabase
    .from("alerts")
    .select("id, mill_id, started_at, ended_at, severity, reason, signals, detector, score, context")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const alert = toAlert(data);
  const context = alertContext(data.context);
  const mills = await getMills(supabase);
  const mill = mills.find((item) => item.id === alert.millId);
  const endedMs = incidentEnd(alert.endedAt, context, alert.startedAt);
  const fromMs = Date.parse(alert.startedAt) - 30_000;
  const toMs = endedMs + 30_000;
  const series = [];
  for (const key of alert.signals) {
    const info = mill?.signals.find((signal) => signal.key === key);
    const history = await getHistory(supabase, alert.millId, key, fromMs, toMs);
    series.push({
      key,
      label: info?.label ?? key,
      unit: info?.unit ?? "",
      rollups: "points" in history ? history.points : [],
      evidence: context?.signals[key] ?? null,
    });
  }

  return { alert, context, fromMs, toMs, series };
}

function incidentEnd(endedAt: string | null, context: AlertContext | null, startedAt: string) {
  if (endedAt) return Date.parse(endedAt);
  const through = context?.through ? Date.parse(context.through) : Number.NaN;
  if (Number.isFinite(through)) return through + 1000;
  return Date.parse(startedAt);
}

async function readPages<T>(load: (from: number, to: number) => PromiseLike<Page<T>>, cap = 2000) {
  const rows: T[] = [];
  const size = 1000;
  for (let offset = 0; offset < cap; offset += size) {
    const { data, error } = await load(offset, offset + size - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < size) break;
  }
  return rows;
}

function sortSignals<T extends { key: string }>(signals: T[]) {
  return [...signals].sort((left, right) => rank(left.key) - rank(right.key));
}

function rank(key: string) {
  const index = SIGNAL_ORDER.indexOf(key);
  return index === -1 ? SIGNAL_ORDER.length : index;
}

function toAlert(row: {
  id: string;
  mill_id: string;
  started_at: string;
  ended_at: string | null;
  severity: string;
  reason: string;
  signals: string[];
  detector: string;
  score: number;
}): AlertSummary {
  return {
    id: row.id,
    millId: row.mill_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    severity: row.severity,
    detector: row.detector,
    score: row.score,
    signals: row.signals,
    reason: row.reason,
  };
}
