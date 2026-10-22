# Phase 01 — Foundation

Stand up the Next.js app so later phases have one place to read configuration and talk to Supabase. This phase does not ingest data, detect anomalies, or build the monitoring screens.

## Depends on

Nothing. The repo is a Next.js 16 shell.

## Scope

- Environment variable names, documented in `.env.example` only. Real secrets stay in `.env`, which is not committed.
- A browser Supabase client that uses the publishable key (`sb_publishable_...`).
- A server Supabase client that uses the secret key (`sb_secret_...`) for ingest and detection. The secret key bypasses row-level security.
- A session-aware server client for signed-in reads. It uses the publishable key plus the user session, not the secret key.
- A route-protection shape: monitoring pages require a session; `/login` and `/signup` stay public; `/api/ingest` is authorized by `INGEST_SECRET`.
- Placeholder home page until the live dashboard in the browser phase replaces it.

Do not use the legacy `anon` or `service_role` API keys.

## Contracts

| Name | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and signed-in server reads |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and signed-in server reads |
| `SUPABASE_URL` | Server writes |
| `SUPABASE_SECRET_KEY` | Ingest and detector writes only |
| `INGEST_SECRET` | Simulator to Ingest API |

Missing public env vars should fail clearly at startup. `SUPABASE_SECRET_KEY` has no `NEXT_PUBLIC_` prefix and must never be imported into a client component.

## Acceptance criteria

- The app runs locally with the env names above.
- Client code cannot reach the secret key.
- A short comment or module boundary shows which client is for the browser, which is for the user session, and which uses the secret key.

## Out of scope

Tables, the simulator, APIs, charts, and sign-up forms. Those start in later phases.
