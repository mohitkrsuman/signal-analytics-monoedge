// ingest needs a different secret key of supabase bypasses the row level security 
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;

    if(!url || !key) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
    }

    return createClient(url, key);
}

