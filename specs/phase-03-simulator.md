# Phase 03 — Simulator

A local, seeded generator that pretends to be the mill PLC. It produces the replay described in the overview and posts batches to ingest once that API exists. Until ingest exists, it can print batches or write them to a local fixture.

## Depends on

[Phase 01](phase-01-foundation.md) for `INGEST_SECRET` and the app URL. The signal list comes from [Phase 02](phase-02-database.md).

## Scope

- Deterministic noise from a fixed seed so two runs match sample for sample.
- 20 ms timestamps across the 10-minute replay, for all six signals.
- Three regimes: normal variation, a coordinated speed and load step, and one cobble.
- Batching: each HTTP body covers about one second (50 timestamps × 6 signals = 300 samples).
- A npm script, for example `npm run simulate`, that replays from t0. Flags for faster-than-real-time are fine; wall-clock 50 Hz is not required for the demo.
- The cobble starts at a documented timestamp: `2026-10-19T10:06:30.000Z`.

Normal operation: signals wander in a tight band around a baseline.

Load step, from 10:04:00 to 10:06:00: motor speed, current, torque, and rolling force move together to a new steady band. Vibration and temperature stay ordinary. This is a real operating change, not a fault.

Cobble, about 8 seconds from 10:06:30: motor current and vibration jump, motor speed and rolling force fall, torque becomes erratic. Temperature barely moves. After the window, signals return toward the post-step baseline.

## Contracts

Batch body:

```json
{
  "mill_id": "RM-01",
  "samples": [
    {
      "signal": "motor_current",
      "timestamp": "2026-10-19T10:00:00.020Z",
      "value": 126.5,
      "unit": "A"
    }
  ]
}
```

Header: `Authorization: Bearer <INGEST_SECRET>`.

Values stay numeric. Timestamps are ISO-8601 UTC and step by 20 ms with no gaps inside a batch.

## Acceptance criteria

- The same seed yields the same values.
- A reviewer can point at the cobble timestamp without reading the generator source.
- The load step changes several load-related signals together and does not look like a single-signal spike.
- The process exits non-zero if ingest rejects a batch, once ingest exists.

## Out of scope

Database writes from the simulator, detection logic, and any UI.
