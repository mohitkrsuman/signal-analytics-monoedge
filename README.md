# Signal Analytics Platform

A web app for watching one steel rolling mill, looking back at stored signals, and opening an abnormal event. There is no physical PLC. A seeded simulator stands in for mill `RM-01` and posts readings into the app.

Sampling is 50 Hz. The simulator sends about one second per request. Charts read 1-second rollups.

## Architecture

The simulator posts batches to the Ingest API. It does not write to Postgres. Ingest checks the batch, saves raw readings and 1-second rollups, then calls the detector. The detector writes alerts. The browser talks to Supabase Auth and the Query API. Signed-in users can read. Anonymous users cannot. The secret key stays on the server and is the only writer of readings, rollups, and alerts.

| Piece | Role |
| --- | --- |
| Simulator | Seeded 10-minute replay, posted as one-second batches |
| Ingest API | `POST /api/ingest`, authorized with `INGEST_SECRET` |
| Detector | Cobble rule and z-score, then one alert row |
| Query API | Live status, history, and incidents for a signed-in user |
| Supabase | Auth, plus Postgres for the catalog, readings, rollups, and alerts |
| Browser | Sign in, Live, History, Incidents |

## Detection

Each signal is compared with its own recent normal level: the middle of the previous 3 minutes, and how wide that band is. Seconds already inside an alert are left out of that baseline.

The load step from `2026-10-19T10:04:00.000Z` to `2026-10-19T10:06:00.000Z` raises motor current, speed, torque, and rolling force together into a steady new band. Vibration stays quiet. That new band becomes the baseline. It does not alert.

A cobble is the four-way pattern over about 2 seconds: motor current and vibration well above baseline, motor speed well below baseline, and rolling force dropping with the speed. "Well above" or "well below" means more than 6 standard deviations. That writes one critical alert. The reason is one sentence a plant operator can read.

If that pattern is absent, a signal that stays beyond 3 standard deviations for 3 seconds writes a warning. A lone spike can count. A coordinated load move does not. When the cobble rule and the z-score both fire, the cobble wins.

An open alert is updated instead of inserting another row. It closes after the signals have been quiet for 3 seconds. Running the same replay again updates that row.

More detail is in [lib/detection.md](lib/detection.md).

## Replay clock

`t0` is `2026-10-19T10:00:00.000Z`. The replay is 10 minutes. The same seed reproduces the same series.

| Window | What happens |
| --- | --- |
| 10:00–10:04 | Normal operation |
| 10:04–10:06 | Load step. Must stay quiet |
| 10:06:30 for about 8 seconds | Cobble. Current and vibration spike, speed and force drop |
| 10:08:30 for about 8 seconds | A second cobble, smaller than the first |
| After each cobble | Recovery toward the post-step band |

Open the first cobble from **Incidents**. The incident shows `10:06:30 UTC`, the affected signals, and the written reason.

## Signals

| Signal | Unit |
| --- | --- |
| `motor_current` | A |
| `motor_speed` | rpm |
| `torque` | Nm |
| `vibration` | mm/s |
| `rolling_force` | kN |
| `temperature` | C |

## Local setup

Node 20.9 or newer.

```bash
npm install
```

Copy `.env.example` to `.env` and fill in the four names. Do not commit `.env`.

| Name | Used by |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and signed-in server reads |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and signed-in server reads. Publishable key only |
| `SUPABASE_SECRET_KEY` | Ingest and the detector. Server only. No `NEXT_PUBLIC_` prefix |
| `INGEST_SECRET` | Simulator calls to `POST /api/ingest` |

Apply the SQL in `supabase/migrations` in filename order. With the Supabase CLI linked to the project:

```bash
npx supabase db push
```

The migration files create the tables. They do not insert the mill. Run this once in the Supabase SQL editor so ingest can accept `RM-01`:

```sql
insert into public.mills (id, display_name, name, description)
values ('RM-01', 'Rolling mill 01', 'RM-01', 'Seed mill for the replay')
on conflict (id) do nothing;

insert into public.signals (mill_id, signal, unit, label) values
  ('RM-01', 'motor_current', 'A', 'Motor current'),
  ('RM-01', 'motor_speed', 'rpm', 'Motor speed'),
  ('RM-01', 'torque', 'Nm', 'Torque'),
  ('RM-01', 'vibration', 'mm/s', 'Vibration'),
  ('RM-01', 'rolling_force', 'kN', 'Rolling force'),
  ('RM-01', 'temperature', 'C', 'Temperature')
on conflict (mill_id, signal) do nothing;
```

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign-up is open at `/signup`. If the Supabase project requires email confirmation, confirm that message before signing in. A signed-out visit to `/` redirects to `/login`.

On **Live**, click **Run replay**. The sidebar clock walks the replay. The cobble alert appears as the clock passes `10:06:30 UTC`. History and Incidents read the same stored rows.

To post the replay through ingest instead of the button, with the dev server already running:

```bash
npm run simulate
```

That script is written for Windows. On macOS or Linux:

```bash
NODE_ENV=development node --experimental-strip-types --disable-warning=ExperimentalWarning simulator/run.mts
```

`INGEST_SECRET` must match `.env`. The script posts 600 batches to `http://localhost:3000/api/ingest`. Add `--realtime` to pause one second between batches. Add `--url https://your-host` to post at a deployed app.

## Deployed app

Live URL: [https://signal-analytics-monoedge.vercel.app](https://signal-analytics-monoedge.vercel.app)

Sign-up is open. There is no shared password in this repo. Create an account on `/signup`, then use **Run replay** on Live. The cobble incident is visible after that replay passes `10:06:30 UTC`.

A signed-out visitor cannot read mill data. The publishable key is the only Supabase key in the browser. `SUPABASE_SECRET_KEY` and `INGEST_SECRET` are set on the host and are not `NEXT_PUBLIC_` variables.

To run the simulator against the deployed ingest API:

```bash
npm run simulate -- --url https://signal-analytics-monoedge.vercel.app
```
