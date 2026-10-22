# Phase 04 — Ingest

The front door for machine data. The Ingest API checks a batch, stores raw readings, updates 1-second rollups, and then hands that window to the detector.

The monitoring screens already exist. They keep reading the preview replay until the Query API replaces it. This phase does not change those screens.

## Depends on

[Phase 02](phase-02-database.md) for tables and [Phase 03](phase-03-simulator.md) for the batch shape. Detector invocation can be a no-op until [Phase 05](phase-05-detector.md).

## Scope

`POST /api/ingest`

- Require `Authorization: Bearer <INGEST_SECRET>`. Reject missing or wrong secrets with 401.
- Reject an empty batch, an unknown mill, an unknown signal, a non-numeric value, or a timestamp that is not a 20 ms step, with 400 and a short error.
- Insert readings with an upsert on `(mill_id, signal, ts)` so a replay can be run twice.
- For each signal, upsert the 1-second rollup buckets touched by the batch: min, max, avg, stddev, count.
- After a successful save, call the detector with the mill id and the time span of the batch.
- Respond `202` with the count of samples stored. Do not return raw rows.

Use the service-role client. Do not trust a user session for this route.

## Contracts

Rollup math for a bucket is computed from the raw samples whose timestamps fall in `[bucket_start, bucket_start + 1s)`. Replaying the same second replaces the rollup rather than double-counting.

The handler stays inside a serverless time budget by accepting about one second of data per call, not a full 10-minute dump.

## Acceptance criteria

- A valid one-second batch lands 300 readings and 6 rollup rows.
- Repeating that batch does not increase the reading count.
- A request without the secret stores nothing.
- A signal key outside the catalog stores nothing.

## Out of scope

Chart queries, alert rows (the detector owns those), and live UI updates.
