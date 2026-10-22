# How detection works

Ingest saves about one second of mill data, then calls `detect`. The detector reads the last few minutes of 1-second rollups and writes at most one alert for an incident.

## Baseline

Each signal is compared with its own recent normal level: the middle of the previous 3 minutes, and how wide that band is. Seconds already inside an alert are left out, so a cobble does not become the new normal.

If motor current, speed, torque, and rolling force all step the same way into a steady new band, and vibration stays quiet, that new band becomes the baseline. The 10:04 load step is this case. It does not alert.

## Cobble

Over about 2 seconds, all four of these are true together:

- motor current is well above baseline
- vibration is well above baseline
- motor speed is well below baseline
- rolling force drops with the speed

"Well above" or "well below" means more than 6 standard deviations. That writes one critical alert. The reason is one sentence: current and vibration spiked, speed and force dropped.

The seeded cobbles are `2026-10-19T10:06:30Z` and `2026-10-19T10:08:30Z`. Each becomes its own alert. The load step between 10:04 and 10:06 does not.

## Z-score

If the cobble pattern is absent, each signal's latest 1-second average is scored against the baseline. A warning is written when one signal stays beyond 3 standard deviations for 3 seconds. A lone current or vibration spike still counts. A coordinated load move does not.

If the cobble rule and the z-score both fire, the cobble wins. Severity stays critical.

## One alert, then close

An open alert is updated instead of inserting another row. It closes after the signals have been quiet for 3 seconds. Running the same replay again updates that row. It does not create a second cobble.

The alert stores the baseline, the latest averages, and which checks passed in `alerts.context`. Live and the incident page read that directly.
