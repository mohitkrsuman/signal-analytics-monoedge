import { getRaw, getSessionClient } from "@/lib/query";

export async function GET(request: Request) {
  const supabase = await getSessionClient();
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const millId = params.get("mill_id");
  const signal = params.get("signal");
  const from = Date.parse(params.get("from") ?? "");
  const to = Date.parse(params.get("to") ?? "");
  if (!millId || !signal) {
    return Response.json({ error: "Missing mill_id or signal" }, { status: 400 });
  }

  const raw = await getRaw(supabase, millId, signal, from, to);
  if ("error" in raw) {
    return Response.json({ error: raw.error }, { status: raw.status });
  }
  return Response.json(raw);
}
