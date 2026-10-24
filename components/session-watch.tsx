"use client";

import { useEffect } from "react";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/utils/supabase/browser";

const SESSION_KEY = "mill-session";
const SESSION_CHANNEL = "mill-session";

function leaveMonitor() {
  window.location.assign("/login");
}

function announceSignOut() {
  try {
    localStorage.setItem(SESSION_KEY, "signed-out");
    const channel = new BroadcastChannel(SESSION_CHANNEL);
    channel.postMessage("signed-out");
    channel.close();
  } catch {
    // The server action still clears the cookie. A hidden tab notices when it is opened again.
  }
}

export function SessionWatch() {
  useEffect(() => {
    let stopped = false;

    function onMessage(event: MessageEvent) {
      if (event.data === "signed-out") leaveMonitor();
    }

    function onStorage(event: StorageEvent) {
      if (event.key === SESSION_KEY && event.newValue === "signed-out") leaveMonitor();
    }

    const channel = new BroadcastChannel(SESSION_CHANNEL);
    channel.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);

    async function checkSession() {
      if (document.visibilityState === "hidden") return;
      const { data, error } = await createClient().auth.getClaims();
      if (stopped) return;
      if (data?.claims) {
        if (localStorage.getItem(SESSION_KEY) === "signed-out") localStorage.removeItem(SESSION_KEY);
        return;
      }
      const signedOut = !error || error.name === "AuthSessionMissingError";
      if (signedOut) leaveMonitor();
    }

    function onVisible() {
      void checkSession();
    }

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      channel.removeEventListener("message", onMessage);
      channel.close();
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

export function SignOutForm() {
  return (
    <form action={signOut} onSubmit={announceSignOut}>
      <button
        type="submit"
        className="min-h-11 shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 md:min-h-0 md:w-full md:py-1.5"
      >
        Sign out
      </button>
    </form>
  );
}
