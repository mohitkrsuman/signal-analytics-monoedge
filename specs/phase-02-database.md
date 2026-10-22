# Phase 02 — Database

Create the Supabase Postgres schema the rest of the app reads and writes. Auth is Supabase Auth. Application data is Readings, Rollups, and Alerts, plus a small catalog of mills and signals.

## Depends on

[Phase 01](phase-01-foundation.md) for the Supabase project and keys.

## Scope

Tables:

- `mills` — `id` (`RM-01`), display name.
- `signals` — mill, signal key, unit, and a short label. Seed the six signals from the overview.
- `readings` — one raw sample: `mill_id`, `signal`, `ts`, `value`. Unique on `(mill_id, signal, ts)`. Index that triple for range reads.
- `rollups` — one 1-second bucket per signal: `bucket_start`, `min`, `max`, `avg`, `stddev`, `count`. Unique on `(mill_id, signal, bucket_start)`.
- `alerts` — one incident: `id`, `mill_id`, `started_at`, `ended_at`, `severity`, `reason`, `signals` (the affected keys), `detector` (`rule` or `zscore`), `score`, and optional JSON context.

Row-level security:

- `authenticated` can select mills, signals, readings, rollups, and alerts.
- `anon` cannot select those tables.
- Inserts and updates go through the service role, which bypasses RLS. Do not grant write policies to signed-in users.

Ship the schema as SQL in the repo so it can be reapplied.

## Contracts

Timestamps are `timestamptz` in UTC. Rollup buckets are aligned to the unix second (`bucket_start` is the inclusive start, width 1000 ms). `count` for a full second of one signal is 50.

An alert reason is a sentence a plant operator can read, not only a numeric score.

## Acceptance criteria

- Applying the SQL on an empty database creates the tables, indexes, seed mill, and six signals.
- A signed-out request cannot read readings or alerts.
- A second insert of the same `(mill_id, signal, ts)` does not create a duplicate row.

## Out of scope

Generating samples, HTTP handlers, and the detector math. The tables only have to be ready for those writers.
