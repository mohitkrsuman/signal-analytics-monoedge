import { getMillSignals } from "@/lib/catalog";
import { detect } from "@/lib/detect";
import { noteIngest } from "@/lib/ingest-head";
import { createAdminClient } from "@/utils/supabase/admin";

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

    const samples = body.samples ?? [];
    if (samples.length === 0) {
        return Response.json({ error: "Empty batch" }, { status: 400 });
    }

    const { mill, signals } = await getMillSignals(body.mill_id);
    if (!mill) {
        return Response.json({ error: "Unknown mill" }, { status: 400 });
    }

    for (const sample of samples) {
        if (!signals.has(sample.signal)) {
            return Response.json({ error: "Unknown signal" }, { status: 400 });
        }
        if (typeof sample.value !== "number" || !Number.isFinite(sample.value)) {
            return Response.json({ error: "Value must be a number" }, { status: 400 });
        }
        const ms = Date.parse(sample.timestamp);
        if (!Number.isFinite(ms) || ms % 20 !== 0) {
            return Response.json({ error: "Timestamp must be a 20 ms step" }, { status: 400 });
        }
    }

    const admin = createAdminClient();
    const saved = await admin.from("readings").upsert(
        samples.map((sample) => ({
            mill_id: mill.id,
            signal: sample.signal,
            ts: sample.timestamp,
            value: sample.value,
        })),
        { onConflict: "mill_id,signal,ts" },
    );
    if (saved.error) {
        return Response.json({ error: saved.error.message }, { status: 500 });
    }

    const rolled = await admin.from("rollups").upsert(buildRollups(mill.id, samples), {
        onConflict: "mill_id,signal,bucket_start",
    });
    if (rolled.error) {
        return Response.json({ error: rolled.error.message }, { status: 500 });
    }

    const times = samples.map((sample) => Date.parse(sample.timestamp));
    const from = new Date(Math.min(...times)).toISOString();
    const to = new Date(Math.max(...times)).toISOString();
    noteIngest(mill.id, to);
    await detect(mill.id, from, to);

    return Response.json({ count: samples.length }, { status: 202 });
}

function buildRollups(millId: string, samples: Sample[]) {
    const groups = new Map<string, { signal: string; bucket_start: string; values: number[] }>();

    for (const sample of samples) {
        const ms = Date.parse(sample.timestamp);
        const bucket_start = new Date(Math.floor(ms / 1000) * 1000).toISOString();
        const key = `${sample.signal}|${bucket_start}`;
        const group = groups.get(key) ?? { signal: sample.signal, bucket_start, values: [] };
        group.values.push(sample.value);
        groups.set(key, group);
    }

    return [...groups.values()].map((group) => {
        const { values } = group;
        const count = values.length;
        const avg = values.reduce((sum, value) => sum + value, 0) / count;
        const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / count;
        return {
            mill_id: millId,
            signal: group.signal,
            bucket_start: group.bucket_start,
            min: Math.min(...values),
            max: Math.max(...values),
            avg,
            stddev: Math.sqrt(variance),
            count,
        };
    });
}
