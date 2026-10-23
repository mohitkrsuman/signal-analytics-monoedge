import { Suspense } from "react";
import { LiveBoard } from "@/components/live-board";
import { PageLoader } from "@/components/page-loader";
import { liveWindowMinutes, MILL_ID } from "@/lib/monitor";

export default function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ minutes?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<PageLoader label="Loading live mill" />}>
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
