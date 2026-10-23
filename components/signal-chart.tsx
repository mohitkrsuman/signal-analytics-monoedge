"use client";

import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatClock, formatValue, type RollupPoint } from "@/lib/monitor";

type ChartRow = {
  t: number;
  avg: number;
  band: [number, number];
};

export function SignalChart({
  label,
  points,
  unit,
  alertFrom,
  alertTo,
  allowZoom = false,
  tall = false,
}: {
  label: string;
  points: RollupPoint[];
  unit?: string;
  alertFrom?: number;
  alertTo?: number;
  allowZoom?: boolean;
  tall?: boolean;
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        No readings yet. Use Run replay to load the mill.
      </p>
    );
  }

  let yMin = Math.min(...points.map((point) => point.min));
  let yMax = Math.max(...points.map((point) => point.max));
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad;
  yMax += yPad;

  const xMin = points[0].t;
  const xMax = points[points.length - 1].t;
  const showAlert =
    alertFrom !== undefined &&
    alertTo !== undefined &&
    alertTo > xMin &&
    alertFrom < xMax;

  const data: ChartRow[] = points.map((point) => ({
    t: point.t,
    avg: point.avg,
    band: [point.min, point.max],
  }));

  return (
    <div
      className={`w-full min-w-0 ${tall ? "h-[50vh] min-h-64 md:h-[70vh]" : allowZoom ? "h-64 md:h-80" : "h-44 md:h-48"}`}
      role="img"
      aria-label={label}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 320, height: tall ? 420 : allowZoom ? 256 : 176 }}
      >
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#f5f5f4" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            ticks={[xMin, xMax]}
            tickFormatter={(value) => formatClock(Number(value)).replace(" UTC", "")}
            tick={{ fill: "#57534e", fontSize: 11 }}
            tickMargin={8}
            tickLine={false}
            axisLine={{ stroke: "#e7e5e4" }}
          />
          <YAxis
            domain={[yMin, yMax]}
            width={44}
            tickCount={4}
            tickFormatter={(value) => formatValue(Number(value))}
            tick={{ fill: "#57534e", fontSize: 11 }}
            tickMargin={4}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: "#a8a29e", strokeDasharray: "3 3" }}
            wrapperStyle={{ maxWidth: "min(18rem, calc(100vw - 2.5rem))", zIndex: 20 }}
            content={(props) => (
              <ChartTooltip
                active={props.active}
                payload={props.payload}
                unit={unit}
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
          <Area
            dataKey="band"
            name="Band"
            stroke="none"
            fill="#e7e5e4"
            isAnimationActive={false}
            activeDot={false}
          />
          <Line
            dataKey="avg"
            name="Average"
            stroke="#1c1917"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#1c1917" }}
            isAnimationActive={false}
          />
          {allowZoom ? (
            <Brush
              dataKey="t"
              height={36}
              stroke="#d6d3d1"
              fill="#fafaf9"
              travellerWidth={16}
              tickFormatter={(value) => formatClock(Number(value)).replace(" UTC", "")}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartRow }>;
  unit?: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const suffix = unit ? ` ${unit}` : "";
  return (
    <div className="max-w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-neutral-900">{formatClock(row.t)}</p>
      <p className="mt-1 text-neutral-800">
        Average {formatValue(row.avg)}
        {suffix}
      </p>
      <p className="text-neutral-500">
        Min {formatValue(row.band[0])}
        {suffix} · Max {formatValue(row.band[1])}
        {suffix}
      </p>
    </div>
  );
}

export function ChartLegend() {
  return (
    <p className="text-xs text-neutral-500">
      Touch or hover a point for that second. The line is the average and the pale fill
      is the min to max band. The red band is the cobble alert. The load step
      is the level change and stays unmarked.
    </p>
  );
}
