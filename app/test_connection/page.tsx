import { createClient } from "@/utils/supabase/server";

export default async function TestConnectionPage() {
  const supabase = await createClient()

  // Try querying a table or system view to test the connection
  const { data, error } = await supabase.from('_realtime').select('*').limit(1)

  console.log(data, error);

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Supabase Connection Test</h1>
      {error ? (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          <p><strong>Connection Failed:</strong> {error.message}</p>
        </div>
      ) : (
        <div className="p-4 bg-green-100 text-green-700 rounded">
          <p><strong>Successfully connected to Supabase!</strong></p>
          <pre className="mt-2 text-xs">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </main>
  )
}