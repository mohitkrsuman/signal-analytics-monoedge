import { createAdminClient } from "@/utils/supabase/admin";

export async function getMillSignals(millId: string) {
    const admin = createAdminClient();

    const mill = await admin.from("mills").select("id").eq("id", millId).maybeSingle();  // maybesinglw will give null instead of 406
    if(mill.error) {
        throw new Error(mill.error.message);
    }
    const signals = await admin.from("signals").select("signal").eq("mill_id", millId);
    if(signals.error) {
        throw new Error(signals.error.message);
    }

    return {
        mill: mill.data,
        signals: new Set((signals.data ?? []).map((row) => row.signal)),
    };
}