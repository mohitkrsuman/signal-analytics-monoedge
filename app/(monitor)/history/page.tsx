import { Suspense } from "react";
import Link from "next/link";
import { HistorySkeleton } from "@/components/page-skeleton";
import { SignalIcon, signalColor } from "@/components/signal-mark";
import { ChartLegend, SignalChart } from "@/components/signal-chart";
import {
  HISTORY_RANGES,
  historyRange,
  MILL_ID,
  overlappingAlert,
  type HistoryRangeKey,
} from "@/lib/monitor";
import { getHistory, getMills, getSessionClient, listAlerts } from "@/lib/query";

export default function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ signal?: string | string[]; range?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <History searchParams={searchParams} />
    </Suspense>
  );
}

async function History({
  searchParams,
}: {
  searchParams: Promise<{ signal?: string | string[]; range?: string | string[] }>;
}) {
  const params = await searchParams;
  const supabase = await getSessionClient();
  const mill = supabase
    ? (await getMills(supabase)).find((item) => item.id === MILL_ID)
    : undefined;
  if (!supabase || !mill) {
    return <p className="text-sm text-neutral-600">Mill {MILL_ID} is not in the catalog.</p>;
  }

  const signal =
    mill.signals.find((item) => item.key === first(params.signal)) ?? mill.signals[0];
  const rangeKey = selectedRange(first(params.range));
  const range = historyRange(rangeKey);
  const history = signal
    ? await getHistory(supabase, MILL_ID, signal.key, range.from, range.to)
    : { points: [] };
  const points = "points" in history ? history.points : [];
  const shade = overlappingAlert(await listAlerts(supabase, MILL_ID), range.from, range.to);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-neutral-600">
          One-second rollups for {signal?.label ?? "the selected signal"}. An alert is marked
          when one falls in this range. The load step is only a change in level.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {mill.signals.map((item) => (
            <Link
              key={item.key}
              href={historyHref(item.key, rangeKey)}
              prefetch
              aria-current={item.key === signal?.key ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded border px-3 py-2 text-sm md:min-h-0 md:py-1.5 ${
                item.key === signal?.key
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white"
              }`}
            >
              <span style={{ color: item.key === signal?.key ? "currentColor" : signalColor(item.key) }}>
                <SignalIcon signal={item.key} />
              </span>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(HISTORY_RANGES) as HistoryRangeKey[]).map((key) => (
            <Link
              key={key}
              href={historyHref(signal?.key ?? "motor_current", key)}
              prefetch
              aria-current={key === rangeKey ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded border px-3 py-2 text-sm md:min-h-0 md:py-1.5 ${
                key === rangeKey
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white"
              }`}
            >
              {HISTORY_RANGES[key].label}
            </Link>
          ))}
        </div>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          {signal ? (
            <span style={{ color: signalColor(signal.key) }}>
              <SignalIcon signal={signal.key} />
            </span>
          ) : null}
          {signal?.label}{" "}
          <span className="font-normal text-neutral-500">{signal?.unit}</span>
        </h2>
        <SignalChart
          label={`${signal?.label ?? "Signal"} from ${range.label}`}
          points={points}
          unit={signal?.unit}
          alertFrom={shade ? Date.parse(shade.startedAt) : undefined}
          alertTo={shade?.endedAt ? Date.parse(shade.endedAt) : undefined}
          allowZoom
        />
        <div className="mt-3">
          <ChartLegend />
        </div>
      </section>
    </div>
  );
}

function historyHref(signal: string, range: HistoryRangeKey) {
  return `/history?signal=${signal}&range=${range}`;
}

function selectedRange(key: string | undefined): HistoryRangeKey {
  if (key && key in HISTORY_RANGES) return key as HistoryRangeKey;
  return "replay";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
