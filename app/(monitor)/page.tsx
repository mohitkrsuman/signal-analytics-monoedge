import Link from "next/link";
import { ChartLegend, SignalChart } from "@/components/signal-chart";
import {
  COBBLE_ALERT,
  formatClock,
  formatValue,
  latest,
  liveRollups,
  MILL_ID,
  millStatus,
  SIGNALS,
} from "@/lib/preview/replay";

export default function LivePage() {
  const status = millStatus();
  const alertStart = Date.parse(COBBLE_ALERT.startedAt);
  const alertEnd = Date.parse(COBBLE_ALERT.endedAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Live</h1>
          <p className="text-sm text-neutral-600">
            Latest value from the end of the replay, with the previous four minutes.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Mill
          <select
            aria-label="Mill"
            defaultValue={MILL_ID}
            className="rounded border border-neutral-300 bg-white px-3 py-2"
          >
            <option value={MILL_ID}>{MILL_ID}</option>
          </select>
        </label>
      </div>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm">
          Status{" "}
          <span
            className={`ml-1 rounded px-2 py-0.5 text-xs font-medium ${
              status === "alert"
                ? "bg-red-100 text-red-900"
                : "bg-emerald-100 text-emerald-900"
            }`}
          >
            {status === "alert" ? "Alert" : "Normal"}
          </span>
        </p>
        <p className="text-sm text-neutral-600">
          The load step is a normal operating change. The cobble has closed.
        </p>
        <Link
          href={`/incidents/${COBBLE_ALERT.id}`}
          className="text-sm underline"
        >
          Latest incident, {formatClock(alertStart)}
        </Link>
      </section>

      <ChartLegend />

      <div className="grid gap-4 lg:grid-cols-2">
        {SIGNALS.map((signal) => {
          const points = liveRollups(signal.key);
          const current = latest(signal.key);
          return (
            <section
              key={signal.key}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">{signal.label}</h2>
                <p className="text-lg font-semibold tabular-nums">
                  {current ? formatValue(current.avg) : "—"}{" "}
                  <span className="text-sm font-normal text-neutral-500">
                    {signal.unit}
                  </span>
                </p>
              </div>
              <SignalChart
                label={`${signal.label} over the last four minutes`}
                points={points}
                unit={signal.unit}
                alertFrom={alertStart}
                alertTo={alertEnd}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
