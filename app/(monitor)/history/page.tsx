import { Suspense } from "react";
import Link from "next/link";
import { ChartLegend, SignalChart } from "@/components/signal-chart";
import {
  COBBLE_ALERT,
  historyRange,
  HISTORY_RANGES,
  isSignalKey,
  rollups,
  SIGNALS,
  type HistoryRangeKey,
  type SignalKey,
} from "@/lib/preview/replay";

export default function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    signal?: string | string[];
    range?: string | string[];
  }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading history…</p>}>
      <History searchParams={searchParams} />
    </Suspense>
  );
}

async function History({
  searchParams,
}: {
  searchParams: Promise<{
    signal?: string | string[];
    range?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const signal = selectedSignal(first(params.signal));
  const rangeKey = selectedRange(first(params.range));
  const range = historyRange(rangeKey);
  const points = rollups(signal.key, range.from, range.to);
  const alertStart = Date.parse(COBBLE_ALERT.startedAt);
  const alertEnd = Date.parse(COBBLE_ALERT.endedAt);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-neutral-600">
          One-second rollups for {signal.label}. The cobble is marked. The load
          step is only a change in level.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {SIGNALS.map((item) => (
            <Link
              key={item.key}
              href={historyHref(item.key, rangeKey)}
              prefetch
              aria-current={item.key === signal.key ? "page" : undefined}
              className={`rounded border px-3 py-1.5 text-sm ${
                item.key === signal.key
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(HISTORY_RANGES) as HistoryRangeKey[]).map((key) => (
            <Link
              key={key}
              href={historyHref(signal.key, key)}
              prefetch
              aria-current={key === rangeKey ? "page" : undefined}
              className={`rounded border px-3 py-1.5 text-sm ${
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

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium">
          {signal.label}{" "}
          <span className="font-normal text-neutral-500">{signal.unit}</span>
        </h2>
        <SignalChart
          label={`${signal.label} from ${range.label}`}
          points={points}
          unit={signal.unit}
          alertFrom={alertStart}
          alertTo={alertEnd}
          allowZoom
        />
        <div className="mt-3">
          <ChartLegend />
        </div>
      </section>
    </div>
  );
}

function historyHref(signal: SignalKey, range: HistoryRangeKey) {
  return `/history?signal=${signal}&range=${range}`;
}

function selectedSignal(key: string | undefined) {
  return isSignalKey(key)
    ? SIGNALS.find((signal) => signal.key === key) ?? SIGNALS[0]
    : SIGNALS[0];
}

function selectedRange(key: string | undefined): HistoryRangeKey {
  if (key && key in HISTORY_RANGES) return key as HistoryRangeKey;
  return "replay";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
