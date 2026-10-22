"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OverlayChart } from "@/components/overlay-chart";
import { SignalIcon, signalColor } from "@/components/signal-mark";
import { ChartLegend, SignalChart } from "@/components/signal-chart";
import {
  DEFAULT_LIVE_MINUTES,
  formatClock,
  formatValue,
  LIVE_WINDOW_MINUTES,
  liveFromWire,
  mergeLive,
  overlappingAlert,
  type LiveSignal,
  type LiveSnapshot,
} from "@/lib/monitor";

const POLL_MS = 1000;
const IDLE_MS = 3000;

export function LiveBoard({ millId, minutes }: { millId: string; minutes: number }) {
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [feed, setFeed] = useState<"receiving" | "idle">("idle");
  const liveRef = useRef<LiveSnapshot | null>(null);
  const lastStamp = useRef<number | null>(null);
  const lastMove = useRef(0);

  useEffect(() => {
    let stopped = false;
    const windowMs = minutes * 60 * 1000;
    liveRef.current = null;

    async function load() {
      const since = newestBucket(liveRef.current);
      const params = new URLSearchParams({ mill_id: millId, minutes: String(minutes) });
      if (since) params.set("since", since);
      const response = await fetch(`/api/live?${params}`, { cache: "no-store" });
      if (stopped) return;
      if (!response.ok) {
        setError("The live reading could not be loaded.");
        return;
      }
      setError(null);
      const next = liveFromWire(await response.json());
      const restarted = Boolean(
        since &&
          liveRef.current?.window &&
          next.window &&
          next.window.to + 2000 < liveRef.current.window.to,
      );
      const merged =
        since && liveRef.current && !restarted ? mergeLive(liveRef.current, next, windowMs) : next;
      liveRef.current = merged;
      setLive(merged);
      noteFeed(merged);
    }

    function noteFeed(snapshot: LiveSnapshot) {
      const newest = newestReading(snapshot);
      const now = Date.now();
      if (lastStamp.current !== null && newest !== null && newest !== lastStamp.current) {
        lastMove.current = now;
        setFeed("receiving");
      } else if (now - lastMove.current > IDLE_MS) {
        setFeed("idle");
      }
      if (newest !== null) lastStamp.current = newest;
    }

    async function loop() {
      while (!stopped) {
        await load();
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    }

    loop();
    return () => {
      stopped = true;
    };
  }, [millId, minutes]);

  if (error) return <p className="text-sm text-neutral-600">{error}</p>;
  if (!live) return <p className="text-sm text-neutral-500">Loading live mill…</p>;

  const shade = live.window ? overlappingAlert(live.alerts, live.window.from, live.window.to) : null;
  const open = live.alerts.find((alert) => alert.endedAt === null) ?? null;
  const latest = live.alerts[0] ?? null;
  const focused = live.signals.find((signal) => signal.key === focus) ?? null;
  const feedTime = newestReading(live);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Live</h1>
          <p className="text-sm text-neutral-600">
            Latest stored reading, and the last {windowText(minutes)} of 1-second rollups before it.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Mill
          <select
            aria-label="Mill"
            defaultValue={live.millId}
            className="rounded border border-neutral-300 bg-white px-3 py-2"
          >
            <option value={live.millId}>{live.millId}</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Chart window">
        {LIVE_WINDOW_MINUTES.map((value) => (
          <Link
            key={value}
            href={value === DEFAULT_LIVE_MINUTES ? "/" : `/?minutes=${value}`}
            scroll={false}
            aria-current={value === minutes ? "page" : undefined}
            className={`rounded border px-3 py-1.5 text-sm ${
              value === minutes
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white"
            }`}
          >
            {value} min
          </Link>
        ))}
      </div>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm">
          Status{" "}
          <span
            className={`ml-1 rounded px-2 py-0.5 text-xs font-medium ${
              live.status === "alert"
                ? "bg-red-100 text-red-900"
                : "bg-emerald-100 text-emerald-900"
            }`}
          >
            {live.status === "alert" ? "Alert" : "Normal"}
          </span>
        </p>
        <p className="text-sm">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              feed === "receiving"
                ? "bg-sky-100 text-sky-950"
                : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {feed === "receiving" ? "Receiving" : "Idle"}
          </span>
          {feedTime !== null ? (
            <span className="ml-2 text-neutral-600">{formatClock(feedTime)}</span>
          ) : null}
        </p>
        {open ? (
          <p className="basis-full text-sm text-red-950">
            {open.reason}{" "}
            <Link href={`/incidents/${open.id}`} className="underline">
              Open incident, {formatClock(Date.parse(open.startedAt))}
            </Link>
          </p>
        ) : latest ? (
          <Link href={`/incidents/${latest.id}`} className="text-sm underline">
            Latest incident, {formatClock(Date.parse(latest.startedAt))}
          </Link>
        ) : (
          <p className="text-sm text-neutral-600">No alerts yet. Run the simulator to replay the mill.</p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium">All signals</h2>
        <OverlayChart
          signals={live.signals}
          alertFrom={shade ? Date.parse(shade.startedAt) : undefined}
          alertTo={shade?.endedAt ? Date.parse(shade.endedAt) : undefined}
        />
      </section>

      <ChartLegend />

      {focused ? (
        <FocusedChart
          signal={focused}
          others={live.signals.filter((signal) => signal.key !== focused.key)}
          shade={shade}
          onShowAll={() => setFocus(null)}
          onFocus={setFocus}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {live.signals.map((signal) => (
            <section
              key={signal.key}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="flex items-center gap-1.5 text-sm font-medium">
                  <span style={{ color: signalColor(signal.key) }}>
                    <SignalIcon signal={signal.key} />
                  </span>
                  {signal.label}
                </h2>
                <div className="flex items-baseline gap-3">
                  <p className="text-lg font-semibold tabular-nums">
                    {signal.value === null ? "—" : formatValue(signal.value)}{" "}
                    <span className="text-sm font-normal text-neutral-500">{signal.unit}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setFocus(signal.key)}
                    className="text-sm underline"
                  >
                    Expand
                  </button>
                </div>
              </div>
              <SignalChart
                label={`${signal.label} 1-second rollup over the last ${windowText(minutes)}`}
                points={signal.rollups}
                unit={signal.unit}
                alertFrom={shade ? Date.parse(shade.startedAt) : undefined}
                alertTo={shade?.endedAt ? Date.parse(shade.endedAt) : undefined}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FocusedChart({
  signal,
  others,
  shade,
  onShowAll,
  onFocus,
}: {
  signal: LiveSignal;
  others: LiveSignal[];
  shade: { startedAt: string; endedAt: string | null } | null;
  onShowAll: () => void;
  onFocus: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium">
            <span style={{ color: signalColor(signal.key) }}>
              <SignalIcon signal={signal.key} />
            </span>
            {signal.label} rollup
          </h2>
          <div className="flex items-baseline gap-3">
            <p className="text-lg font-semibold tabular-nums">
              {signal.value === null ? "—" : formatValue(signal.value)}{" "}
              <span className="text-sm font-normal text-neutral-500">{signal.unit}</span>
            </p>
            <button type="button" onClick={onShowAll} className="text-sm underline">
              Show all
            </button>
          </div>
        </div>
        <SignalChart
          tall
          label={`${signal.label} 1-second rollup`}
          points={signal.rollups}
          unit={signal.unit}
          alertFrom={shade ? Date.parse(shade.startedAt) : undefined}
          alertTo={shade?.endedAt ? Date.parse(shade.endedAt) : undefined}
        />
      </section>
      <div className="flex flex-wrap gap-2">
        {others.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onFocus(item.key)}
            className="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm"
          >
            <span style={{ color: signalColor(item.key) }}>
              <SignalIcon signal={item.key} />
            </span>
            {item.label}{" "}
            <span className="tabular-nums">
              {item.value === null ? "—" : formatValue(item.value)} {item.unit}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function windowText(minutes: number) {
  return minutes === 1 ? "minute" : `${minutes} minutes`;
}

function newestBucket(snapshot: LiveSnapshot | null) {
  let latest = "";
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const signal of snapshot?.signals ?? []) {
    const point = signal.rollups.at(-1);
    if (point && point.t > latestMs) {
      latestMs = point.t;
      latest = point.bucketStart;
    }
  }
  return latest || null;
}

function newestReading(snapshot: LiveSnapshot) {
  let latest = Number.NEGATIVE_INFINITY;
  for (const signal of snapshot.signals) {
    const ms = signal.timestamp ? Date.parse(signal.timestamp) : Number.NaN;
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  return latest === Number.NEGATIVE_INFINITY ? null : latest;
}
