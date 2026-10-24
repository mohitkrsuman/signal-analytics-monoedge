import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { MonitorNav, MonitorNavFallback } from "@/components/monitor-nav";
import { ReplayButton } from "@/components/replay-button";
import { SessionWatch, SignOutForm } from "@/components/session-watch";
import { createClient } from "@/utils/supabase/server";

export function MonitorShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50 text-neutral-900 md:flex-row">
      <SessionWatch />
      <aside className="flex w-full shrink-0 flex-col bg-white md:sticky md:top-0 md:h-screen md:w-60 md:overflow-y-auto md:border-r md:border-neutral-200">
        <div className="sticky top-0 z-30 border-b border-neutral-200 bg-white pt-[env(safe-area-inset-top)] md:static md:border-b-0 md:pt-0">
          <div className="flex items-baseline justify-between gap-3 px-4 py-3 md:block md:px-5 md:py-5">
            <p className="text-sm font-semibold tracking-tight">Signal Analytics</p>
            <p className="text-xs text-neutral-500 md:mt-0.5">Mill RM-01</p>
          </div>
          <Suspense fallback={<MonitorNavFallback />}>
            <MonitorNav />
          </Suspense>
        </div>
        <div className="border-b border-neutral-200 px-4 py-3 md:mt-auto md:border-t md:border-b-0 md:py-4">
          <Suspense fallback={<p className="text-sm text-neutral-500">Loading session…</p>}>
            <SessionControls />
          </Suspense>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:py-6">
        {children}
      </main>
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
    <div className="flex flex-col gap-2 md:gap-3">
      <ReplayButton />
      <div className="flex items-center justify-between gap-3 md:flex-col md:items-stretch">
        <p className="min-w-0 truncate text-sm text-neutral-600">{email ?? "Signed in"}</p>
        <SignOutForm />
      </div>
    </div>
  );
}
