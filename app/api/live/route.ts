import { MILL_ID } from "@/lib/monitor";
import { getLive, getSessionClient } from "@/lib/query";

export async function GET(request: Request) {
  const supabase = await getSessionClient();
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const millId = params.get("mill_id") ?? MILL_ID;
  const live = await getLive(supabase, millId, params.get("since"));
  if (!live) return Response.json({ error: "Unknown mill" }, { status: 404 });

  return Response.json({
    mill_id: live.millId,
    status: live.status,
    window: live.window,
    signals: live.signals.map((signal) => ({
      key: signal.key,
      label: signal.label,
      unit: signal.unit,
      value: signal.value,
      timestamp: signal.timestamp,
      rollups: signal.rollups.map((point) => ({
        bucket_start: point.bucketStart,
        min: point.min,
        max: point.max,
        avg: point.avg,
      })),
    })),
    alerts: live.alerts.map((alert) => ({
      id: alert.id,
      mill_id: alert.millId,
      started_at: alert.startedAt,
      ended_at: alert.endedAt,
      severity: alert.severity,
      detector: alert.detector,
      score: alert.score,
      signals: alert.signals,
      reason: alert.reason,
    })),
  });
}
