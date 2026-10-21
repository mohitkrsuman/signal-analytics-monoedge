import type { ReactNode } from "react";
import { MonitorShell } from "@/components/monitor-shell";

export default function MonitorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <MonitorShell>{children}</MonitorShell>;
}
