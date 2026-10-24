import { Suspense } from "react";
import { LiveBoard } from "@/components/live-board";
import { LiveSkeleton } from "@/components/page-skeleton";
import { liveWindowMinutes, MILL_ID } from "@/lib/monitor";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta(
  "Live",
  "Live readings for mill RM-01. Status, the latest value of each signal, and the last few minutes of 1-second rollups.",
  "/",
);

export default function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ minutes?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<LiveSkeleton />}>
      <Live searchParams={searchParams} />
    </Suspense>
  );
}

async function Live({
  searchParams,
}: {
  searchParams: Promise<{ minutes?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.minutes) ? params.minutes[0] : params.minutes;
  return <LiveBoard millId={MILL_ID} minutes={liveWindowMinutes(raw)} />;
}
