import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/utils/supabase/server";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Signal Analytics Platform</h1>
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading session…</p>}>
        <SignedInHome />
      </Suspense>
    </main>
  );
}

async function SignedInHome() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const emailClaim = data?.claims.email;
  const email = typeof emailClaim === "string" ? emailClaim : null;

  return (
    <div className="flex flex-col gap-4">
      <p>{email ? `Signed in as ${email}.` : "Signed in."}</p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
