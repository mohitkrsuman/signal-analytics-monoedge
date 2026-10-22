import { MILL_ID } from "@/lib/monitor";
import { listAlerts, getSessionClient } from "@/lib/query";

export async function GET(request: Request) {
  const supabase = await getSessionClient();
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const millId = new URL(request.url).searchParams.get("mill_id") ?? MILL_ID;
  const alerts = await listAlerts(supabase, millId);
  return Response.json({
    alerts: alerts.map((alert) => ({
      id: alert.id,
      mill_id: alert.millId,
      started_at: alert.startedAt,
      ended_at: alert.endedAt,
      severity: alert.severity,
      reason: alert.reason,
      signals: alert.signals,
      detector: alert.detector,
    })),
  });
}
