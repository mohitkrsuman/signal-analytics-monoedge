import type { ReactNode } from "react";

function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded bg-neutral-200 motion-reduce:animate-none ${className}`} />
  );
}

function Status({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6">
      <p className="sr-only">{label}</p>
      {children}
    </div>
  );
}

export function LiveSkeleton() {
  return (
    <Status label="Loading live mill">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Bone className="h-8 w-24" />
          <Bone className="h-4 w-full max-w-xl" />
        </div>
        <Bone className="h-11 w-28" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <Bone key={index} className="h-11 w-16 shrink-0" />
        ))}
      </div>
      <Bone className="h-14 w-full rounded-lg" />
      <section className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
        <Bone className="mb-3 h-4 w-24" />
        <Bone className="h-56 w-full sm:h-72" />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <section
            key={index}
            className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4"
          >
            <Bone className="mb-3 h-4 w-36" />
            <Bone className="h-44 w-full md:h-48" />
          </section>
        ))}
      </div>
    </Status>
  );
}

export function HistorySkeleton() {
  return (
    <Status label="Loading history">
      <div className="flex flex-col gap-2">
        <Bone className="h-8 w-32" />
        <Bone className="h-4 w-full max-w-xl" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Bone key={index} className="h-11 w-32" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Bone key={index} className="h-11 w-28" />
          ))}
        </div>
      </div>
      <section className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
        <Bone className="mb-3 h-4 w-40" />
        <Bone className="h-64 w-full md:h-80" />
      </section>
    </Status>
  );
}

export function IncidentsSkeleton() {
  return (
    <Status label="Loading incidents">
      <div className="flex flex-col gap-2">
        <Bone className="h-8 w-36" />
        <Bone className="h-4 w-48" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <section
            key={index}
            className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <Bone className="h-4 w-40" />
              <Bone className="h-5 w-16" />
            </div>
            <Bone className="mt-3 h-4 w-56" />
            <Bone className="mt-3 h-4 w-full" />
          </section>
        ))}
      </div>
    </Status>
  );
}

export function IncidentSkeleton() {
  return (
    <Status label="Loading incident">
      <div className="flex flex-col gap-2">
        <Bone className="h-4 w-28" />
        <Bone className="h-8 w-64" />
        <Bone className="h-4 w-full max-w-lg" />
      </div>
      <section className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
        <Bone className="h-4 w-20" />
        <Bone className="mt-3 h-4 w-full" />
        <Bone className="mt-2 h-4 w-3/4" />
      </section>
      <section className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
        <Bone className="mb-3 h-4 w-40" />
        <Bone className="h-56 w-full sm:h-72" />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <section
            key={index}
            className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4"
          >
            <Bone className="mb-3 h-4 w-36" />
            <Bone className="h-44 w-full md:h-48" />
          </section>
        ))}
      </div>
    </Status>
  );
}

export function MonitorSkeleton() {
  return (
    <Status label="Loading">
      <div className="flex flex-col gap-2">
        <Bone className="h-8 w-40" />
        <Bone className="h-4 w-full max-w-md" />
      </div>
      <Bone className="h-14 w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <section
            key={index}
            className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4"
          >
            <Bone className="mb-3 h-4 w-32" />
            <Bone className="h-44 w-full" />
          </section>
        ))}
      </div>
    </Status>
  );
}
