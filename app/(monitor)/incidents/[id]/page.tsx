import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartLegend, SignalChart } from "@/components/signal-chart";
import {
  alertById,
  formatClock,
  incidentWindow,
  rollups,
  signalByKey,
} from "@/lib/preview/replay";

export default function IncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading incident…</p>}>
      <Incident params={params} />
    </Suspense>
  );
}

async function Incident({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const alert = alertById(id);
  if (!alert) notFound();

  const window = incidentWindow(alert);
  const started = Date.parse(alert.startedAt);
  const ended = Date.parse(alert.endedAt);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/incidents" className="text-sm underline">
          All incidents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Cobble on RM-01</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {formatClock(started)} to {formatClock(ended)} · {alert.severity} ·{" "}
          {alert.detector} detector · score {alert.score}
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium">Reason</h2>
        <p className="mt-2 text-sm">{alert.reason}</p>
        <p className="mt-3 text-sm text-neutral-600">
          Signals: {alert.signals.map((key) => signalByKey(key).label).join(", ")}
        </p>
      </section>

      <ChartLegend />

      <div className="grid gap-4 lg:grid-cols-2">
        {alert.signals.map((key) => {
          const signal = signalByKey(key);
          return (
            <section
              key={key}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <h2 className="mb-2 text-sm font-medium">
                {signal.label}{" "}
                <span className="font-normal text-neutral-500">{signal.unit}</span>
              </h2>
              <SignalChart
                label={`${signal.label} around the cobble`}
                points={rollups(key, window.from, window.to)}
                unit={signal.unit}
                alertFrom={started}
                alertTo={ended}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
