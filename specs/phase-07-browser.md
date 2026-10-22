# Phase 07 — Browser

The screens an operator uses: sign in, watch the mill live, explore history, and open an incident. Charts use 1-second rollups. They do not draw all 50 samples per second.

This phase is built before ingest, the detector, and the query API. Pages read the seeded replay in `lib/preview/replay.ts`. A banner on every monitoring screen says the charts are that replay, from 19 Oct 2026 10:00–10:10 UTC, and that ingest and the Query API replace it later. The pages do not query Postgres and they do not poll.

## Depends on

[Phase 01](phase-01-foundation.md) for the session client. The preview stands in for [Phase 06](phase-06-query-api.md).

## Scope

Routes other than auth require a session. A signed-out visit redirects to `/login`. A sidebar holds the sections Live, History, and Incidents, plus the signed-in email and sign out. On a narrow screen the sections sit in a row above the page.

- `/login` and `/signup` — email and password through Supabase Auth. Errors stay on the form. After success, go to `/`.
- `/` live — mill selector with only `RM-01`. Status is `Normal` or `Alert`. Each of the six signals shows its latest value, unit, and a chart of the last four minutes of the replay. The cobble interval is shaded when it falls in that window. Link to the latest incident. Polling starts when the Query API replaces the preview.
- `/history?signal=&range=` — signal buttons for the catalog, default `motor_current`. Range buttons:
  - `replay` — full replay, 10:00:00–10:10:00 UTC
  - `load` — load step, 10:03:30–10:06:30 UTC
  - `cobble` — cobble, 10:06:00–10:07:30 UTC
  Plot the 1-second average and a min/max band. Shade the cobble. Leave the load step unmarked so it reads as a level change. Hovering a chart shows that second's time, average, min, and max. The history chart includes a brush so the operator can zoom inside the selected range.
- `/incidents` — alerts, newest first: time, severity, signal labels, and the reason sentence.
- `/incidents/[id]` — the reason, the timestamp range, severity, detector, and score. Charts for each affected signal from 30 seconds before `started_at` to 30 seconds after `ended_at`. The preview alert id is `cobble-rm-01`. An unknown id is not found.

Empty states: no readings yet, and no alerts yet, each with one sentence telling the operator to run the simulator.

Visual design should be calm and readable on a laptop. Desktop is the target. Mobile can stack the charts.

## Contracts

The preview cobble matches the overview clock:

| Field | Value |
| --- | --- |
| `started_at` | `2026-10-19T10:06:30.000Z` |
| `ended_at` | `2026-10-19T10:06:38.000Z` |
| `severity` | `critical` |
| `detector` | `rule` |
| `signals` | `motor_current`, `vibration`, `motor_speed`, `rolling_force` |

The reason is one sentence a plant operator can read. After the cobble the mill status is `Normal`, because the alert has ended. The load step raises current, speed, torque, and force together and stays at that band. Vibration spikes only during the cobble. Temperature drifts and barely moves.

The UI calls Supabase Auth and the preview module. It does not call `/api/ingest` and does not hold the service role key. Signal names on screen use the catalog labels and the unit. [Phase 06](phase-06-query-api.md) deletes the preview once its routes return these same shapes.

## Acceptance criteria

- A new user can sign up, sign in, and cannot open `/` while signed out.
- Live view shows all six signals for `RM-01`, with the cobble visible in the recent window and status `Normal` after it closes.
- History makes the cobble and the quiet load step distinguishable. Switching signal or range updates the chart.
- Opening the cobble incident shows `10:06:30 UTC`, the four affected signals, and the written reason.
- Signing out returns the user to `/login`.

## Out of scope

Account management beyond sign-up and sign-in, multiple mills of real complexity, notifications outside the app, ingest, detection, and query routes.
