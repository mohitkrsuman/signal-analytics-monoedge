"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SignalIcon, signalColor } from "@/components/signal-mark";
import { formatClock, formatValue, type RollupPoint } from "@/lib/monitor";

type Series = {
  key: string;
  label: string;
  unit: string;
  rollups: RollupPoint[];
};

type Row = { t: number } & Record<string, number>;

export function OverlayChart({
  signals,
  alertFrom,
  alertTo,
}: {
  signals: Series[];
  alertFrom?: number;
  alertTo?: number;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const { rows, raw } = indexSeries(signals, alertFrom);
  const shifts = cobbleShifts(signals, alertFrom, alertTo);
  const visible = signals.filter((signal) => !hidden.includes(signal.key) && signal.rollups.length > 0);

  if (rows.length === 0) {
    return <p className="text-sm text-neutral-600">No readings yet. Run the simulator to load the mill.</p>;
  }

  const xMin = rows[0].t;
  const xMax = rows[rows.length - 1].t;
  const showAlert =
    alertFrom !== undefined && alertTo !== undefined && alertTo > xMin && alertFrom < xMax;
  let yMin = 100;
  let yMax = 100;
  for (const row of rows) {
    for (const signal of visible) {
      const value = row[signal.key];
      if (value === undefined) continue;
      yMin = Math.min(yMin, value);
      yMax = Math.max(yMax, value);
    }
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const pad = (yMax - yMin) * 0.08;
  yMin -= pad;
  yMax += pad;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-600">
        {showAlert
          ? "100 is the level just before the shaded cobble. The percent beside each name is how far that signal moved during it."
          : "100 is each signal’s first second in this window. Select a name to hide its line."}
      </p>
      <div className="flex flex-wrap gap-2">
        {signals.map((signal) => {
          const off = hidden.includes(signal.key);
          const shift = shifts.get(signal.key);
          return (
            <button
              key={signal.key}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((current) =>
                  current.includes(signal.key)
                    ? current.filter((key) => key !== signal.key)
                    : [...current, signal.key],
                )
              }
              className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-sm ${
                off ? "border-neutral-200 text-neutral-400" : "border-neutral-300 bg-white text-neutral-900"
              }`}
            >
              <span style={{ color: off ? "currentColor" : signalColor(signal.key) }}>
                <SignalIcon signal={signal.key} />
              </span>
              {signal.label}
              {showAlert && shift !== undefined ? (
                <span className="tabular-nums" style={{ color: off ? "currentColor" : signalColor(signal.key) }}>
                  {formatShift(shift)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-neutral-600">Choose a signal to draw its line.</p>
      ) : (
        <div className="h-72 w-full min-w-0" role="img" aria-label="All signals compared with their own starting level">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 288 }}>
            <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="#f5f5f4" />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={[xMin, xMax]}
                tickFormatter={(value) => formatClock(Number(value))}
                tick={{ fill: "#57534e", fontSize: 11 }}
                tickMargin={8}
                tickLine={false}
                axisLine={{ stroke: "#e7e5e4" }}
              />
              <YAxis
                domain={[yMin, yMax]}
                width={48}
                tickCount={4}
                tickFormatter={(value) => `${Math.round(Number(value))}`}
                tick={{ fill: "#57534e", fontSize: 11 }}
                tickMargin={4}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: "#a8a29e", strokeDasharray: "3 3" }}
                content={(props) => (
                  <OverlayTooltip
                    active={props.active}
                    payload={props.payload}
                    signals={signals}
                    hidden={hidden}
                    raw={raw}
                  />
                )}
              />
              {showAlert ? (
                <ReferenceArea
                  x1={Math.max(alertFrom, xMin)}
                  x2={Math.min(alertTo, xMax)}
                  fill="#fecaca"
                  fillOpacity={1}
                  strokeOpacity={0}
                  ifOverflow="hidden"
                />
              ) : null}
              {visible.map((signal) => (
                <Line
                  key={signal.key}
                  dataKey={signal.key}
                  name={signal.label}
                  stroke={signalColor(signal.key)}
                  strokeWidth={1.75}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function indexSeries(signals: Series[], alertFrom?: number) {
  const byTime = new Map<number, Row>();
  const raw = new Map<number, Record<string, number>>();
  for (const signal of signals) {
    const base = referenceLevel(signal, alertFrom);
    for (const point of signal.rollups) {
      const row = byTime.get(point.t) ?? { t: point.t };
      const values = raw.get(point.t) ?? {};
      values[signal.key] = point.avg;
      raw.set(point.t, values);
      if (base) row[signal.key] = (point.avg / base) * 100;
      byTime.set(point.t, row);
    }
  }
  return { rows: [...byTime.values()].sort((left, right) => left.t - right.t), raw };
}

function cobbleShifts(signals: Series[], alertFrom?: number, alertTo?: number) {
  const shifts = new Map<string, number>();
  if (alertFrom === undefined || alertTo === undefined || alertTo <= alertFrom) return shifts;
  for (const signal of signals) {
    const base = referenceLevel(signal, alertFrom);
    const during = signal.rollups.filter((point) => point.t >= alertFrom && point.t < alertTo);
    if (!base || during.length === 0) continue;
    let extreme = during[0].avg;
    for (const point of during) {
      if (Math.abs(point.avg / base - 1) > Math.abs(extreme / base - 1)) extreme = point.avg;
    }
    shifts.set(signal.key, (extreme / base - 1) * 100);
  }
  return shifts;
}

function referenceLevel(signal: Series, alertFrom?: number) {
  const first = signal.rollups.find((point) => Number.isFinite(point.avg) && point.avg !== 0)?.avg;
  if (alertFrom === undefined) return first;
  const before = signal.rollups.filter((point) => point.t >= alertFrom - 15_000 && point.t < alertFrom);
  if (before.length === 0) return first;
  return before.reduce((sum, point) => sum + point.avg, 0) / before.length;
}

function formatShift(percent: number) {
  const rounded = Math.round(percent);
  if (rounded > 0) return `+${rounded}%`;
  if (rounded < 0) return `−${Math.abs(rounded)}%`;
  return "0%";
}

function OverlayTooltip({
  active,
  payload,
  signals,
  hidden,
  raw,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Row }>;
  signals: Series[];
  hidden: string[];
  raw: Map<number, Record<string, number>>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const values = raw.get(row.t) ?? {};
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-neutral-900">{formatClock(row.t)}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {signals
          .filter((signal) => !hidden.includes(signal.key) && values[signal.key] !== undefined)
          .map((signal) => (
            <li key={signal.key} className="flex items-center gap-1.5 text-neutral-800">
              <span style={{ color: signalColor(signal.key) }}>
                <SignalIcon signal={signal.key} className="size-3.5" />
              </span>
              {signal.label} {formatValue(values[signal.key])} {signal.unit}
              {typeof row[signal.key] === "number" ? (
                <span className="text-neutral-500">{formatShift(row[signal.key] - 100)}</span>
              ) : null}
            </li>
          ))}
      </ul>
    </div>
  );
}
