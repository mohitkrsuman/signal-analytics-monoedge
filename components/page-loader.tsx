import { LoaderCircle } from "lucide-react";

export function PageLoader({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 text-sm text-neutral-600"
    >
      <LoaderCircle
        className="h-8 w-8 animate-spin text-neutral-800 motion-reduce:animate-none"
        aria-hidden
      />
      <p>{label}</p>
    </div>
  );
}
