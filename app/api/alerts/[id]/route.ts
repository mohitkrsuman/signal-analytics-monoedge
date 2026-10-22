import { getAlert, getRaw, getSessionClient } from "@/lib/query";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSessionClient();
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const incident = await getAlert(supabase, id);
  if (!incident) return Response.json({ error: "Unknown alert" }, { status: 404 });

  const raw =
    incident.toMs - incident.fromMs <= 2 * 60 * 1000
      ? await Promise.all(
          incident.alert.signals.map(async (signal) => {
            const samples = await getRaw(
              supabase,
              incident.alert.millId,
              signal,
              incident.fromMs,
              incident.toMs,
            );
            return {
              signal,
              samples: "samples" in samples ? samples.samples : [],
            };
          }),
        )
      : [];

  return Response.json({
    id: incident.alert.id,
    mill_id: incident.alert.millId,
    started_at: incident.alert.startedAt,
    ended_at: incident.alert.endedAt,
    severity: incident.alert.severity,
    reason: incident.alert.reason,
    signals: incident.alert.signals,
    detector: incident.alert.detector,
    score: incident.alert.score,
    context: incident.context,
    from: new Date(incident.fromMs).toISOString(),
    to: new Date(incident.toMs).toISOString(),
    series: incident.series.map((series) => ({
      key: series.key,
      label: series.label,
      unit: series.unit,
      rollups: series.rollups.map((point) => ({
        bucket_start: point.bucketStart,
        min: point.min,
        max: point.max,
        avg: point.avg,
      })),
    })),
    raw,
  });
}
