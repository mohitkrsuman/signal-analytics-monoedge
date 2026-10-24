import { saveBatch } from "@/lib/ingest-batch";
import { getSessionClient } from "@/lib/query";
import { BATCH_COUNT, BATCH_MS, generateBatch, REPLAY_START, waitForBatch } from "@/simulator/replay.mts";

export const maxDuration = 60;

export async function POST(request: Request) {
  const started = Date.now();
  const supabase = await getSessionClient();
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let index = Number.NaN;
  try {
    const body = await request.json();
    index = body?.index;
    console.log("simulate", index);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Number.isInteger(index) || index < 0 || index >= BATCH_COUNT) {
    return Response.json({ error: "Batch is outside the replay" }, { status: 400 });
  }

  const saved = await saveBatch(generateBatch(index));
  if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });

  const at = new Date(Date.parse(REPLAY_START) + index * BATCH_MS).toISOString();
  await waitForBatch(started);
  return Response.json({ index, total: BATCH_COUNT, at });
}
