# Simulator study notes

`replay.mts` and `run.mts` are stubs. The behavior below is what you rebuild. The fixture file is only output; do not study it.

Phase 3 is a local stand-in for the mill PLC. It does not write to Postgres, does not decide alerts, and has no UI. It builds one 10-minute replay and either posts it to ingest or, until that API exists, writes a local file. Ignore that file while studying. The terminal checkpoints are the test.

Run it with `npm run simulate`.

## What the spec requires

One mill, `RM-01`. Six signals, each sample carrying a signal key, an ISO-8601 UTC timestamp, a numeric value, and a unit.

| Signal | Unit | What it represents |
| --- | --- | --- |
| `motor_current` | A | Drive load |
| `motor_speed` | rpm | Line speed |
| `torque` | Nm | Mechanical load |
| `vibration` | mm/s | Mechanical disturbance |
| `rolling_force` | kN | Stand force |
| `temperature` | C | Slow thermal drift |

Sampling is 50 Hz, so timestamps step by 20 ms. A post is about one second: 50 timestamps times 6 signals, which is 300 samples. Ten minutes is 600 of those batches, 180,000 samples. The replay starts at `2026-10-19T10:00:00.000Z`. The same seed must reproduce the same numbers. The cobble time must be visible without opening the generator: the script prints `2026-10-19T10:06:30.000Z` before it does any work.

Three regimes:

- Until 10:04, every signal wanders in a tight band around its baseline.
- From 10:04 to 10:06, current, speed, torque, and rolling force move together onto a new steady band. Vibration and temperature stay ordinary. This is an operating change, not a fault. The new band stays after 10:06. "Post-step baseline" means that new level.
- From 10:06:30 for about 8 seconds, current and vibration jump, speed and force fall, torque swings, temperature barely moves. Then the signals ease back to the post-step band.

When ingest exists, the body is `mill_id` plus `samples`, and the header is `Authorization: Bearer <INGEST_SECRET>`. A rejected batch must exit non-zero. A missing route or a missing secret is not a rejection: the script falls back to a local file.

## How a value is decided

Every sample is independent. Nothing walks a random stream from the start of the replay, so batch 394 does not depend on generating the previous 393 batches.

Time is an integer millisecond offset from the replay start. Sample 0 is 10:00:00.000. Sample 1 is 20 ms later. Batch `n` is second `n`.

Two envelopes, both between 0 and 1, shape the regimes:

- Load level is 0 before 10:04. It eases from 0 to 1 over the next 5 seconds, then stays at 1 for the rest of the replay, including after the cobble.
- Cobble level is 0 outside the event. It rises over 200 ms starting at 10:06:30, stays at 1 until 8 seconds have passed, then falls back to 0 over 2 seconds. The event is finished by about 10:06:40.

The operating point is `baseline + step * load level`. A step of 0 means that signal ignores the load change. Noise is a Gaussian wiggle whose width is the signal's `noise` field. The cobble then adds or subtracts a fixed offset, or, for torque, a wide wobble around the operating point. The result is rounded to that signal's digits.

| Signal | Baseline | Load step | Cobble |
| --- | --- | --- | --- |
| Motor current | 120 A | +28 A | +190 A, and the noise widens |
| Motor speed | 100 rpm | +8 rpm | −42 rpm |
| Torque | 62000 Nm | +9000 Nm | stays near the operating point but swings hard |
| Vibration | 2.2 mm/s | none | +12 mm/s |
| Rolling force | 820 kN | +140 kN | −480 kN |
| Temperature | 650.4 C | none | none; a slow sine over about 4 minutes, plus tiny noise |

Torque is stored in Nm. 62000 Nm is about 62 kNm. The overview unit is Nm, so do not relabel it to match a chart axis that says kNm.

Expected one-second averages, which the script already prints:

- 10:02, normal: current about 120 A, speed about 100 rpm, torque about 62000 Nm, vibration about 2.2 mm/s, force about 820 kN, temperature about 650.4 C.
- 10:05, load step: current about 148 A, speed about 108 rpm, torque about 71000 Nm, force about 960 kN. Vibration and temperature still ordinary.
- 10:06:34, inside the cobble: current about 338 A, speed about 66 rpm, vibration about 14 mm/s, force about 480 kN. Torque's average stays near the load-step level; the spread is the point. Temperature stays near 650 C.

## `replay.mts` — the generator

This file has no I/O. An interviewer who says "change the physics" means this file. An interviewer who says "change how it is sent" means `run.mts`.

Constants at the top are the contract a reviewer can point at: mill id, seed `20261019`, replay start, load-step start and end, cobble start. `SAMPLES_PER_SECOND` is 50. `BATCH_COUNT` is 600. `SIGNALS` is the catalog: key, unit, baseline, step, noise width, and decimal digits.

`SignalKey`, `Sample`, and `Batch` are the shapes. A batch is `{ mill_id, samples }`. A sample is `{ signal, timestamp, value, unit }`.

`nextRandom` is the random number generator. Given a seed it returns a function that yields the next number in the range 0 to 1. Each call multiplies the state, adds a constant, and divides by 2³². Same seed, same sequence. It is not `Math.random()`.

`sampleSeed` mixes the replay seed, the sample index, and the signal index into one integer. That is why two runs match sample for sample, and why asking for the cobble second does not require replaying the four minutes before it.

`unitNoise` calls `nextRandom(sampleSeed(...))` once and subtracts 0.5, so the wiggle sits around zero. Each signal at each timestamp gets its own seed, so changing the noise of temperature does not shift the noise of current.

`smoothstep` clamps its input to 0..1. Both envelopes use it so a regime change is a short ramp, not a single-sample spike.

`loadLevel` answers "how far is this timestamp into the new operating band?"

`cobbleLevel` answers "how far is this timestamp into the cobble?" Zero means the cobble formula adds nothing.

`roundTo` keeps values numeric and stable. Current and speed use 2 decimals, torque and force 1, vibration and temperature 3.

`sampleValue` is the only place a number is invented. It reads the signal row, both envelopes, and the noise, then branches:

- current: operating point, plus a large positive cobble term
- speed: operating point, minus a cobble term
- torque: operating point, plus noise that grows about 30 times during the cobble, plus a sine wobble that exists only while the cobble level is above 0
- vibration: baseline, plus a cobble term, no load step
- rolling force: operating point, minus a large cobble term
- temperature: baseline plus the slow sine, no load step and no cobble term

`generateBatch` is the public function. It rejects an index outside 0..599. For each of the 50 offsets in that second it builds a timestamp, then pushes the six signals in catalog order. Timestamps inside the batch are 20 ms apart. The last sample of batch `n` and the first of batch `n + 1` are also 20 ms apart, so the replay has no gaps. Batch 0 starts at 10:00:00.000. The cobble timestamp falls in batch 390, because 6 minutes and 30 seconds is second 390.

## `run.mts` — the command

`printPlan` logs the mill, the replay start, the load-step window, and the cobble timestamp. That last line is the acceptance check "a reviewer can point at the cobble without reading the source."

`readFlag` looks up `--fixture` and `--url`. If the flag is absent it returns nothing. If the flag is present but has no value, it returns an empty string, and the caller substitutes the default.

`envValue` scans `.env` text for one name. It skips blanks and comments and strips one pair of quotes. It does not print the value.

`ingestSecret` prefers `INGEST_SECRET` already in the environment, otherwise reads that same name from `.env`. The phase 1 name is `INGEST_SECRET`. A differently named key in `.env` is ignored.

`appUrl` uses `--url`, otherwise `APP_URL`, otherwise `http://localhost:3000`. A trailing slash is removed so the path joins cleanly.

`writeLine` writes one line and, if the buffer is full, waits until it drains. That is what keeps 600 batches from sitting in memory.

`writeFixture` creates the directory, writes one JSON batch per line, and logs progress every 60 seconds of replay. This is the fallback, not the thing to study. Do not open the file.

`postBatch` POSTs one batch to `/api/ingest` with the bearer secret and a 10 second timeout. A 404, a connection error, or a timeout means ingest is not there yet. Any other non-success status is a rejection: it logs the status and body, and `main` exits 1. A 2xx continues.

`mean` averages one signal across the 50 samples of a batch. `printSnapshot` rounds that average to the signal's digits and logs one line. `printCheckpoints` does this for three seconds:

- batch 120, normal, 10:02:00
- batch 300, load step, 10:05:00
- batch 394, cobble, 10:06:34

`main` is the decision tree:

1. Reject unknown flags with exit 1. Known flags are `--fixture`, `--url`, and `--realtime`.
2. Print the plan and the three checkpoints. This happens before any file or HTTP call, so a bad ingest target still shows the physics.
3. If `--fixture` was passed, write the file and stop. With no path, the default path is used.
4. If there is no secret, log that and write the file.
5. Otherwise post batches from 0 through 599. On the first "not there" result, stop posting and write the file. On a real rejection, exit 1 immediately and do not keep posting. `--realtime` waits one second between successful posts. The default is as fast as the network allows.
6. A thrown error at the bottom is logged and exits 1.

## What you would change in an interview

| They ask for | Touch |
| --- | --- |
| Cobble earlier, later, or longer | `COBBLE_START` and the 8 second duration inside `cobbleLevel`. The printed sentence in `printPlan` must stay true. |
| A harder or softer cobble | The offsets in `sampleValue` (190 A, 42 rpm, 12 mm/s, 480 kN, the torque multiplier). |
| Load step that also moves vibration | Give vibration a non-zero `step`. Today that step is 0 on purpose. |
| Less noise, or noise that is not Gaussian | `noise` on the signal, or `unitNoise`. |
| A different seed | `REPLAY_SEED`. Both runs must still match each other. |
| 20 ms gaps or a different batch length | `SAMPLE_MS`. `SAMPLES_PER_SECOND` and `BATCH_COUNT` are derived from it. The spec wants 20 ms and 300 samples per batch, so say that before changing it. |
| Another CLI flag | Add it to the known set in `main`, read it with `readFlag`, and branch before the post loop. |
| Post somewhere else | `INGEST_PATH` or `appUrl`. |
| Exit non-zero on a 401 or 400 | Already `postBatch` plus the `if (!result.ok) process.exit(1)` line. Do not treat those statuses as "ingest missing." |
| Do not alert on the load step | Not this phase. The detector does that later. Here, the four load signals must move together, and vibration must not spike alone. |

Out of scope if they push: inserting rows, computing rollups, z-scores, and any page.

## How to test

Read the terminal. The three checkpoint lines are the whole physics check.

```bash
npm run simulate -- --fixture /tmp/rm-01-check.jsonl
```

You want:

- The cobble line says `2026-10-19T10:06:30.000Z`.
- The 10:02 line sits on the baselines.
- The 10:05 line is higher on current, speed, torque, and force, and ordinary on vibration and temperature.
- The 10:06:34 line shows current and vibration up, speed and force down, temperature still near 650.
- Running the command twice prints the same three lines. That is the seed check.

Point the file at `/tmp` so you are not staring at the repo output. Delete it when you are done. You do not need to open it.

To see one function's behavior, log inside it and rerun the same command. Useful logs, one at a time:

- In `loadLevel` and `cobbleLevel`, log the timestamp and the returned 0..1. At 10:02 both are 0. At 10:05 load is 1 and cobble is 0. At 10:06:34 cobble is 1. After 10:07 cobble is 0 and load is still 1.
- In `sampleValue`, log the signal key, the operating point, the cobble level, and the rounded value. That shows which branch fired.
- In `generateBatch`, log the batch index, the first timestamp, the last timestamp, and `samples.length`. Length must be 300. The gap between the first two distinct timestamps must be 20 ms.
- In `postBatch`, log the status. A 404 should fall back. A 400 or 401 should be the rejection message and the process should end without a "Posted 600" line.

Typecheck after a signature change:

```bash
npx tsc -p simulator/tsconfig.json --noEmit
```

That config exists because the app `tsconfig` excludes this folder. Node's types are turned on there. If an import of `node:fs` goes red, this is the config that fixes it, not the Next.js one.

Unknown flag check: `npm run simulate -- --nope` should exit 1 and print `Unknown flag`. Secret check: with `INGEST_SECRET` unset, the log says the secret is not set and it writes the local file instead of posting. Rejection check, once ingest exists: a wrong secret or a bad batch must exit 1. `--realtime` only matters while posts are succeeding; it sleeps one second between them.
