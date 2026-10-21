import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";

export default function TestConnectionPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Supabase Connection Test</h1>
      <Suspense fallback={<p>Checking the Supabase connection…</p>}>
        <ConnectionResult />
      </Suspense>
    </main>
  );
}

async function ConnectionResult() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("_realtime").select("*").limit(1);

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded">
        <p>
          <strong>Connection Failed:</strong> {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-100 text-green-700 rounded">
      <p>
        <strong>Successfully connected to Supabase!</strong>
      </p>
      <pre className="mt-2 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
