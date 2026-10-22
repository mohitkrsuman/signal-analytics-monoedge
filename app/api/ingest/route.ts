import { saveBatch } from "@/lib/ingest-batch";

type Sample = { signal: string; timestamp: string; value: number };

export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET;
  const header = request.headers.get("authorization");

  if (!secret || header !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { mill_id: string; samples: Sample[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const saved = await saveBatch(body);
  if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json({ count: saved.count }, { status: 202 });
}
