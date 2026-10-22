import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { signOut } from "@/app/auth/actions";
import { MonitorNav, MonitorNavFallback } from "@/components/monitor-nav";
import { ReplayButton } from "@/components/replay-button";
import { createClient } from "@/utils/supabase/server";

export function MonitorShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50 text-neutral-900 md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-neutral-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="px-5 py-5">
          <p className="text-sm font-semibold tracking-tight">Signal Analytics</p>
          <p className="mt-0.5 text-xs text-neutral-500">Mill RM-01</p>
        </div>
        <Suspense fallback={<MonitorNavFallback />}>
          <MonitorNav />
        </Suspense>
        <div className="mt-auto border-t border-neutral-200 px-4 py-4">
          <Suspense fallback={<p className="text-sm text-neutral-500">Loading session…</p>}>
            <SessionControls />
          </Suspense>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-6">{children}</main>
    </div>
  );
}

async function SessionControls() {
  // getClaims() reads the current time. connection() waits until request
  // time so that read stays outside the prerender.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const emailClaim = data?.claims.email;
  const email = typeof emailClaim === "string" ? emailClaim : null;

  return (
    <div className="flex flex-col gap-3">
      <ReplayButton />
      <p className="truncate text-sm text-neutral-600">{email ?? "Signed in"}</p>
      <form action={signOut}>
        <button
          type="submit"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
