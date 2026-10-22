import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OverlayChart } from "@/components/overlay-chart";
import { SignalIcon, signalColor } from "@/components/signal-mark";
import { ChartLegend, SignalChart } from "@/components/signal-chart";
import { formatClock, formatValue, type SignalEvidence } from "@/lib/monitor";
import { getAlert, getSessionClient } from "@/lib/query";

export default function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading incident…</p>}>
      <Incident params={params} />
    </Suspense>
  );
}

async function Incident({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSessionClient();
  const incident = supabase ? await getAlert(supabase, id) : null;
  if (!incident) notFound();

  const { alert, series } = incident;
  const started = Date.parse(alert.startedAt);
  const ended = incident.toMs - 30_000;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/incidents" className="text-sm underline">
          All incidents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Incident on {alert.millId}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {formatClock(started)}
          {alert.endedAt ? ` to ${formatClock(ended)}` : " · open"} · {alert.severity} ·{" "}
          {alert.detector} detector · score {alert.score}
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium">Reason</h2>
        <p className="mt-2 text-sm">{alert.reason}</p>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-neutral-700">
          {series.map((signal) => (
            <li key={signal.key}>{signalMove(signal.label, signal.unit, signal.evidence)}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium">All affected signals</h2>
        <OverlayChart signals={series} alertFrom={started} alertTo={ended} />
      </section>

      <ChartLegend />

      <div className="grid gap-4 lg:grid-cols-2">
        {series.map((signal) => (
          <section
            key={signal.key}
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <span style={{ color: signalColor(signal.key) }}>
                <SignalIcon signal={signal.key} />
              </span>
              {signal.label}{" "}
              <span className="font-normal text-neutral-500">{signal.unit}</span>
            </h2>
            <SignalChart
              label={`${signal.label} around the incident`}
              points={signal.rollups}
              unit={signal.unit}
              alertFrom={started}
              alertTo={ended}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

function signalMove(label: string, unit: string, evidence: SignalEvidence | null) {
  if (!evidence) return label;
  const suffix = unit ? ` ${unit}` : "";
  if (evidence.direction === "steady") {
    return `${label} held near ${formatValue(evidence.baseline)}${suffix}.`;
  }
  const verb = evidence.direction === "down" ? "dropped" : "rose";
  return `${label} ${verb} from ${formatValue(evidence.baseline)}${suffix} to ${formatValue(evidence.latest)}${suffix}.`;
}
