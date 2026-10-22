# Phase 08 — Ship

Make the finished app reviewable. This phase is documentation, a demo account, and a deployment checklist. It does not add product behavior.

## Depends on

The browser shell, ingest, detector, and query API are working locally. The screens read stored data, not the preview replay.

## Scope

Update the README so a reviewer can run the project without asking questions:

- What the app is, in a few sentences.
- Architecture: simulator, ingest, detector, query API, Supabase, browser.
- How detection works: cobble rule, z-score, and why the load step is ignored.
- Local setup: Node version, env vars from `.env.example`, how to apply the SQL, `npm install`, `npm run dev`, `npm run simulate`.
- The replay clock: t0 is `2026-10-19T10:00:00.000Z`, the load step is 10:04, the cobble is 10:06:30.
- Demo email and password for the deployed app, or a note that sign-up is open.
- The live URL once the app is deployed.

Deployment checklist:

- Host the Next.js app on Vercel or another host.
- Set the same env vars on the host. Do not expose the service role or ingest secret to the browser.
- Point the simulator at the deployed ingest URL for a live run, or document that history is already loaded.
- Confirm a signed-out visitor cannot see readings, and the demo user can open the cobble incident.

## Contracts

The README is the submission description named in the brief. Keep secrets out of git. `.env.example` lists names only.

## Acceptance criteria

- A new machine can follow the README to the live dashboard.
- The README states how to start the simulator and where the abnormal event is.
- The deployed URL loads, auth works, and the cobble incident is visible to the demo user.

## Out of scope

New signals, a second detector, and CI polish beyond what is required to deploy.
