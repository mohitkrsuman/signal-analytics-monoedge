import { LiveBoard } from "@/components/live-board";
import { MILL_ID } from "@/lib/monitor";

export default function LivePage() {
  return <LiveBoard millId={MILL_ID} />;
}
