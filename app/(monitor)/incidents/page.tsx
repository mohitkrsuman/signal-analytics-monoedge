import Link from "next/link";
import { alerts, formatClock, signalByKey } from "@/lib/preview/replay";

export default function IncidentsPage() {
  const rows = alerts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Incidents</h1>
        <p className="text-sm text-neutral-600">
          Alerts for RM-01, newest first.
        </p>
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
                  </p>
                  <p className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
                    {alert.severity}
                  </p>
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  {alert.signals.map((key) => signalByKey(key).label).join(", ")}
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
