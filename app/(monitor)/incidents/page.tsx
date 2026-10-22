import { Suspense } from "react";
import Link from "next/link";
import { type AlertSummary, formatClock, MILL_ID, signalLabel } from "@/lib/monitor";
import { getMills, getSessionClient, listAlerts } from "@/lib/query";

export default function IncidentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading incidents…</p>}>
      <Incidents />
    </Suspense>
  );
}

async function Incidents() {
  const supabase = await getSessionClient();
  const rows = supabase ? await listAlerts(supabase, MILL_ID) : [];
  const mill = supabase
    ? (await getMills(supabase)).find((item) => item.id === MILL_ID)
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Incidents</h1>
        <p className="text-sm text-neutral-600">Alerts for {MILL_ID}, newest first.</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600">
          No alerts yet. Run the simulator to replay the mill.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((alert) => (
            <li key={alert.id}>
              <Link
                href={`/incidents/${alert.id}`}
                className="block rounded-lg border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-400"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {formatClock(Date.parse(alert.startedAt))}
                    <span className="ml-2 font-normal text-neutral-600">{incidentState(alert)}</span>
                  </p>
                  <p
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      alert.severity === "warning"
                        ? "bg-amber-100 text-amber-950"
                        : "bg-red-100 text-red-900"
                    }`}
                  >
                    {alert.severity}
                  </p>
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  {alert.signals
                    .map((key) => signalLabel(mill?.signals ?? [], key))
                    .join(", ")}
                </p>
                <p className="mt-2 text-sm">{alert.reason}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function incidentState(alert: AlertSummary) {
  if (!alert.endedAt) return "Open";
  const seconds = Math.max(0, Math.round((Date.parse(alert.endedAt) - Date.parse(alert.startedAt)) / 1000));
  if (seconds < 60) return `Closed · ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `Closed · ${minutes}m ${seconds % 60}s`;
}
