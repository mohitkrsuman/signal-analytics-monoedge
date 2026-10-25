import { createAdminClient } from "@/utils/supabase/admin";

type MillSignals = { mill: { id: string } | null; signals: Set<string> };

// A mill posts every second, and its catalog rarely changes. Cache it briefly so each batch skips two lookups.
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: MillSignals }>();

export async function getMillSignals(millId: string): Promise<MillSignals> {
    const hit = cache.get(millId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

    const admin = createAdminClient();

    const [mill, signals] = await Promise.all([
        admin.from("mills").select("id").eq("id", millId).maybeSingle(),  // maybesinglw will give null instead of 406
        admin.from("signals").select("signal").eq("mill_id", millId),
    ]);
    if(mill.error) {
        throw new Error(mill.error.message);
    }
    if(signals.error) {
        throw new Error(signals.error.message);
    }

    const value = {
        mill: mill.data,
        signals: new Set((signals.data ?? []).map((row) => row.signal)),
    };
    if (value.mill) cache.set(millId, { at: Date.now(), value });
    return value;
}
