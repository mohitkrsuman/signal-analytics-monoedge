# Phase 06 — Query API

Read APIs for the browser. They answer three questions: what is the mill doing now, what happened in a time range, and what did a given alert look like.

The browser routes already exist and read `lib/preview/replay.ts`. This phase replaces that module with these routes and then removes the preview. The screens stay.

## Depends on

[Phase 02](phase-02-database.md) for tables, [Phase 04](phase-04-ingest.md) for data, and [Phase 05](phase-05-detector.md) for alerts. Every route requires a signed-in user and uses the session client, so RLS applies.

## Scope

- `GET /api/mills` — mills and their signal catalog (key, label, unit).
- `GET /api/live?mill_id=RM-01` — latest value, unit, and timestamp per signal, plus mill status: `normal` or `alert` when an alert is still open. Also return about four minutes of 1-second rollups per signal so the live charts can keep their recent window. `load_change` is not a status.
- `GET /api/history?mill_id&signal&from&to` — 1-second rollups (`bucket_start`, `min`, `max`, `avg`) for that signal. Cap the range (for example 2 hours) and downsample further if the UI asks for a long span.
- `GET /api/history/raw?mill_id&signal&from&to` — raw samples only when the range is 2 minutes or less. Used by the incident zoom.
- `GET /api/alerts?mill_id=` — newest alerts first: id, started_at, ended_at, severity, reason, signals, detector.
- `GET /api/alerts/:id` — the alert plus a window from 30 seconds before `started_at` to 30 seconds after `ended_at`, as rollups for every affected signal. Include raw series when that window is short enough.

Return 401 when there is no session. Return 404 for an unknown mill or alert.

## Contracts

History responses are ordered by time ascending. Live values are the newest reading per signal, not a client-side cache. Timestamps stay ISO-8601 UTC.

The browser never queries Postgres directly for chart data. It uses these routes. Wire the existing screens to them and delete `lib/preview/replay.ts`:

| Screen | Route |
| --- | --- |
| Live values, status, and the four-minute charts | `GET /api/live` |
| History for the selected signal and range | `GET /api/history` |
| Incident list | `GET /api/alerts` |
| Incident detail and its charts | `GET /api/alerts/:id` |

## Acceptance criteria

- A signed-out call returns 401 and no rows.
- After a full replay, history for `motor_current` across the 10 minutes shows the load step and the cobble.
- The cobble alert endpoint includes the four affected signals and enough points to see the spike against the minute before it.

## Out of scope

Page layout, chart components, and sign-in forms.
