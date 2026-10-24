"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OverlayChart } from "@/components/overlay-chart";
import { LiveSkeleton } from "@/components/page-skeleton";
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
  type AlertSummary,
  type LiveSignal,
  type LiveSnapshot,
} from "@/lib/monitor";

const POLL_MS = 1000;
const IDLE_MS = 3000;
const STORED_MINUTES = LIVE_WINDOW_MINUTES[LIVE_WINDOW_MINUTES.length - 1];

export function LiveBoard({ millId, minutes }: { millId: string; minutes: number }) {
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [feed, setFeed] = useState<"receiving" | "idle">("idle");
  const [backMs, setBackMs] = useState(0);
  const liveRef = useRef<LiveSnapshot | null>(null);
  const lastStamp = useRef<number | null>(null);
  const lastMove = useRef(0);

  useEffect(() => {
    let stopped = false;
    const windowMs = STORED_MINUTES * 60 * 1000;
    liveRef.current = null;

    async function load() {
      const since = newestBucket(liveRef.current);
      const params = new URLSearchParams({ mill_id: millId, minutes: String(STORED_MINUTES) });
      if (since) params.set("since", since);
      const response = await fetch(`/api/live?${params}`, { cache: "no-store" });
      if (stopped) return;
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
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
  }, [millId]);

  if (error) return <p className="text-sm text-neutral-600">{error}</p>;
  if (!live) return <LiveSkeleton />;

  const span = signalSpan(live.signals);
  const viewMs = minutes * 60 * 1000;
  const maxBack = span ? Math.max(0, span.to - span.from - viewMs) : 0;
  const back = Math.min(backMs, maxBack);
  const viewTo = span ? span.to - back : 0;
  const viewFrom = viewTo - viewMs;
  const shown = span ? sliceSignals(live.signals, viewFrom, viewTo) : live.signals;
  const shade = span ? overlappingAlert(live.alerts, viewFrom, viewTo) : null;
  const open = live.alerts.find((alert) => alert.endedAt === null) ?? null;
  const latest = live.alerts[0] ?? null;
  const focused = shown.find((signal) => signal.key === focus) ?? null;
  const feedTime = newestReading(live);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Live</h1>
          <p className="text-sm text-neutral-600">
            Latest stored reading. Charts show the last {windowText(minutes)}. The slider moves that window back from the current time.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Mill
          <select
            aria-label="Mill"
            defaultValue={live.millId}
            className="min-h-11 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base md:w-auto md:text-sm"
          >
            <option value={live.millId}>{live.millId}</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Chart window">
        {LIVE_WINDOW_MINUTES.map((value) => (
          <Link
            key={value}
            href={value === DEFAULT_LIVE_MINUTES ? "/" : `/?minutes=${value}`}
            scroll={false}
            aria-current={value === minutes ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded border px-3 py-2 text-sm md:min-h-0 ${
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
        <AlertSound openId={open?.id ?? null} alerts={live.alerts} />
        {open ? (
          <p className="basis-full text-sm text-red-950">
            {open.reason}{" "}
            <Link href={`/incidents/${open.id}`} className="underline">
              Open incident, {formatClock(Date.parse(open.startedAt))}
            </Link>
          </p>
        ) : latest ? (
          <Link href={`/incidents/${latest.id}`} className="inline-flex min-h-11 items-center text-sm underline md:min-h-0">
            Latest incident, {formatClock(Date.parse(latest.startedAt))}
          </Link>
        ) : (
          <p className="text-sm text-neutral-600">No alerts yet. Use Run replay to load the mill.</p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
        <h2 className="mb-3 text-sm font-medium">All signals</h2>
        <OverlayChart
          signals={shown}
          alertFrom={shade ? Date.parse(shade.startedAt) : undefined}
          alertTo={shade?.endedAt ? Date.parse(shade.endedAt) : undefined}
        />
        {span ? (
          <TimeSlider
            start={viewFrom}
            end={viewTo}
            maxBack={maxBack}
            back={back}
            onBack={setBackMs}
          />
        ) : null}
      </section>

      <ChartLegend />

      {focused ? (
        <FocusedChart
          signal={focused}
          others={shown.filter((signal) => signal.key !== focused.key)}
          shade={shade}
          onShowAll={() => setFocus(null)}
          onFocus={setFocus}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((signal) => (
            <section
              key={signal.key}
              className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4"
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
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
                    className="inline-flex min-h-11 items-center text-sm underline md:min-h-0"
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
      <section className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
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
            <button type="button" onClick={onShowAll} className="inline-flex min-h-11 items-center text-sm underline md:min-h-0">
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
            className="inline-flex min-h-11 items-center gap-1.5 rounded border border-neutral-300 bg-white px-3 py-2 text-sm md:min-h-0 md:py-1.5"
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

const REPLAY_CLOCK_EVENT = "mill-replay-clock";

function AlertSound({
  openId,
  alerts,
}: {
  openId: string | null;
  alerts: AlertSummary[];
}) {
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef(new Set<string>());
  const pending = useRef<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const openSeen = useRef<Set<string> | null>(null);
  const simAt = useRef<number | null>(null);
  const replayFrom = useRef<number | null>(null);

  useEffect(() => {
    function announce(alert: AlertSummary | undefined) {
      if (!alert) return;
      const key = soundKey(alert);
      if (sounded.current.has(key)) return;
      if (!ready || !beep(audio.current)) {
        pending.current = key;
        if (ready) {
          setReady(false);
          setBlocked(true);
        }
        return;
      }
      sounded.current.add(key);
      pending.current = null;
    }

    const waiting = alerts.find((alert) => soundKey(alert) === pending.current);
    if (waiting && ready) announce(waiting);

    if (seen.current === null || openSeen.current === null) {
      seen.current = new Set(alerts.map((alert) => alert.id));
      openSeen.current = new Set(alerts.filter((alert) => alert.endedAt === null).map((alert) => alert.id));
      return;
    }

    const arrived = alerts.find((alert) => !seen.current?.has(alert.id));
    const reopened = alerts.find((alert) => alert.endedAt === null && !openSeen.current?.has(alert.id));
    seen.current = new Set(alerts.map((alert) => alert.id));
    openSeen.current = new Set(alerts.filter((alert) => alert.endedAt === null).map((alert) => alert.id));
    announce(arrived ?? reopened);

    const sim = simAt.current;
    const from = replayFrom.current;
    if (sim === null || from === null) return;
    for (const alert of alerts) {
      if (inReplay(alert, from, sim)) announce(alert);
    }
  }, [alerts, ready]);

  useEffect(() => {
    function onClock(event: Event) {
      const at = Date.parse((event as CustomEvent<string>).detail);
      if (!Number.isFinite(at)) return;
      const previous = simAt.current;
      if (previous !== null && at + 2000 < previous) {
        sounded.current.clear();
        replayFrom.current = at;
      }
      simAt.current = at;
      replayFrom.current ??= at;
      const from = replayFrom.current;
      for (const alert of alerts) {
        if (!inReplay(alert, from, at) || sounded.current.has(soundKey(alert))) continue;
        const key = soundKey(alert);
        if (!ready || !beep(audio.current)) {
          pending.current = key;
          if (ready) {
            setReady(false);
            setBlocked(true);
          }
          continue;
        }
        sounded.current.add(key);
        pending.current = null;
      }
    }

    window.addEventListener(REPLAY_CLOCK_EVENT, onClock);
    return () => window.removeEventListener(REPLAY_CLOCK_EVENT, onClock);
  }, [alerts, ready]);

  function allow() {
    const ctx = audio.current ?? (typeof AudioContext === "undefined" ? null : new AudioContext());
    if (!ctx) {
      setBlocked(true);
      return;
    }
    audio.current = ctx;
    const resume = ctx.resume();
    try {
      playTone(ctx);
    } catch {
      setBlocked(true);
      return;
    }
    void resume
      .then(() => {
        if (ctx.state !== "running") {
          setBlocked(true);
          return;
        }
        const open = openId ? alerts.find((alert) => alert.id === openId) : undefined;
        const waiting = alerts.find((alert) => soundKey(alert) === pending.current);
        const hit = waiting ?? (open && !sounded.current.has(soundKey(open)) ? open : undefined);
        if (hit) {
          sounded.current.add(soundKey(hit));
          pending.current = null;
        }
        setReady(true);
        setBlocked(false);
      })
      .catch(() => setBlocked(true));
  }

  if (ready) return null;

  return (
    <button
      type="button"
      onClick={allow}
      className="min-h-11 rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
    >
      {blocked ? "Alert sound is blocked. Try again" : "Allow alert sound"}
    </button>
  );
}

function inReplay(alert: AlertSummary, from: number, at: number) {
  const start = Date.parse(alert.startedAt);
  return start >= from && at >= start;
}

function soundKey(alert: AlertSummary) {
  return `${alert.id}@${alert.startedAt}`;
}

function beep(ctx: AudioContext | null) {
  if (!ctx || ctx.state !== "running") return false;
  try {
    playTone(ctx);
    return true;
  } catch {
    return false;
  }
}

function playTone(ctx: AudioContext) {
  const now = ctx.currentTime;
  for (const start of [0, 0.22]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now + start);
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + 0.2);
  }
}

function TimeSlider({
  start,
  end,
  maxBack,
  back,
  onBack,
}: {
  start: number;
  end: number;
  maxBack: number;
  back: number;
  onBack: (backMs: number) => void;
}) {
  const atCurrent = back < 1000;
  return (
    <div className="mt-3 flex flex-col gap-1">
      <input
        type="range"
        min={0}
        max={Math.max(maxBack, 1)}
        step={1000}
        value={maxBack - back}
        disabled={maxBack < 1000}
        aria-label="Slide the charts back from the current time"
        aria-valuetext={atCurrent ? "Current" : formatClock(end)}
        onChange={(event) => onBack(maxBack - Number(event.target.value))}
        className="h-11 w-full accent-neutral-900"
      />
      <p className="text-xs text-neutral-500">
        {maxBack < 1000
          ? "This window already reaches the start of the stored replay."
          : "Drag left to look earlier. The right end is the current time."}
      </p>
      <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span>{formatClock(start)}</span>
        {atCurrent ? (
          <span>Current</span>
        ) : (
          <button type="button" onClick={() => onBack(0)} className="inline-flex min-h-11 items-center underline md:min-h-0">
            Back to current
          </button>
        )}
      </div>
    </div>
  );
}

function signalSpan(signals: LiveSignal[]) {
  let from = Number.POSITIVE_INFINITY;
  let to = Number.NEGATIVE_INFINITY;
  for (const signal of signals) {
    const first = signal.rollups[0];
    const last = signal.rollups.at(-1);
    if (first && first.t < from) from = first.t;
    if (last && last.t > to) to = last.t;
  }
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return { from, to };
}

function sliceSignals(signals: LiveSignal[], from: number, to: number) {
  return signals.map((signal) => ({
    ...signal,
    rollups: signal.rollups.filter((point) => point.t >= from && point.t <= to),
  }));
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
