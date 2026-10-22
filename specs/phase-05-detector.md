# Phase 05 — Detector

Decide whether the batch that was just stored is abnormal. The detector uses a cobble rule and a per-signal z-score. It writes at most one alert for a single incident, and it stays quiet during the legitimate load step.

The incident screens already show one preview cobble. This phase writes the real alert row. It does not change the page layout.

## Depends on

[Phase 04](phase-04-ingest.md) calls it after each saved batch. It reads recent rollups and writes `alerts`.

## Scope

Run on the server, inside the ingest path, using the service role. It is not a public route.

**Cobble rule.** Over a short window (about 2 seconds) flag a cobble when all of these are true together:

- `motor_current` is well above its recent baseline
- `vibration` is well above its recent baseline
- `motor_speed` drops well below its recent baseline
- `rolling_force` drops with the speed

**Z-score.** For each signal, compare the latest 1-second average to a rolling baseline (mean and stddev over the previous few minutes, excluding an open alert). Record a z-score alert when the absolute z-score stays beyond 3 for several consecutive seconds.

**Operating-change exclusion.** If speed, current, torque, and force move together into a new stable band, do not alert. Update the baseline so the new band becomes normal. A lone vibration or current spike still qualifies.

**Debounce.** While an alert is open, extend `ended_at` instead of inserting another row. Close it after the signals settle. One cobble produces one alert.

Alert fields:

- `started_at` and `ended_at`
- `signals` that participated
- `detector`: `rule` or `zscore` (cobble rule wins if both fire)
- `score`
- `reason` in plain language, naming the signals and the direction they moved
- `severity`: `warning` for z-score, `critical` for the cobble rule

## Contracts

The seeded cobble at `2026-10-19T10:06:30.000Z` produces one `critical` rule alert whose `signals` include `motor_current`, `vibration`, `motor_speed`, and `rolling_force`.

The 10:04:00 load step produces no alert.

## Acceptance criteria

- Replaying the 10-minute scenario twice does not duplicate the cobble alert.
- The alert reason can be shown in the UI without further formatting.
- Normal noise alone does not alert.

## Out of scope

Training a model, email or SMS notification, and any chart. Incident display is Phase 07.
