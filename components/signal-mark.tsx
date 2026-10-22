import {
  Activity,
  ArrowDownToLine,
  Gauge,
  RotateCw,
  Thermometer,
  Zap,
  type LucideIcon,
} from "lucide-react";

const MARKS: Record<string, { icon: LucideIcon; color: string }> = {
  motor_current: { icon: Zap, color: "#9a3412" },
  motor_speed: { icon: Gauge, color: "#1e40af" },
  torque: { icon: RotateCw, color: "#6b21a8" },
  vibration: { icon: Activity, color: "#9f1239" },
  rolling_force: { icon: ArrowDownToLine, color: "#115e59" },
  temperature: { icon: Thermometer, color: "#92400e" },
};

export function signalColor(key: string) {
  return MARKS[key]?.color ?? "#44403c";
}

export function SignalIcon({ signal, className = "size-4 shrink-0" }: { signal: string; className?: string }) {
  const Icon = MARKS[signal]?.icon ?? Activity;
  return <Icon className={className} aria-hidden />;
}
