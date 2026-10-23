"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  type AuthFormState,
  signIn,
  signUp,
} from "@/app/auth/actions";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

const copy = {
  "sign-in": {
    title: "Sign in",
    submitLabel: "Sign in",
    action: signIn,
    alternateHref: "/signup",
    alternateLabel: "Create an account",
  },
  "sign-up": {
    title: "Create an account",
    submitLabel: "Sign up",
    action: signUp,
    alternateHref: "/login",
    alternateLabel: "Sign in",
  },
} as const;

export function AuthForm({ mode }: AuthFormProps) {
  const form = copy[mode];
  const [state, action, pending] = useActionState<
    AuthFormState | undefined,
    FormData
  >(form.action, undefined);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-neutral-500">Signal Analytics Platform</p>
        <h1 className="text-2xl font-semibold">{form.title}</h1>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="min-h-11 rounded border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            className="min-h-11 rounded border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        {state?.error ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}
        {state?.message ? (
          <p className="text-sm text-neutral-700" role="status">
            {state.message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? "Please wait…" : form.submitLabel}
        </button>
      </form>
      <Link href={form.alternateHref} className="inline-flex min-h-11 items-center text-sm underline">
        {form.alternateLabel}
      </Link>
    </main>
  );
}
