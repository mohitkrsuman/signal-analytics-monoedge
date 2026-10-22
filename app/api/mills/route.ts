import { getMills, getSessionClient } from "@/lib/query";

export async function GET() {
  const supabase = await getSessionClient();
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const mills = await getMills(supabase);
  return Response.json({
    mills: mills.map((mill) => ({
      id: mill.id,
      display_name: mill.displayName,
      signals: mill.signals.map((signal) => ({
        key: signal.key,
        label: signal.label,
        unit: signal.unit,
      })),
    })),
  });
}
