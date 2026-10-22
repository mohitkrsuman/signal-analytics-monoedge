"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/monitor";

export function ReplayButton() {
  const [running, setRunning] = useState(false);
  const [at, setAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const stopped = useRef(false);
  const runningRef = useRef(false);

  useEffect(() => {
    return () => {
      stopped.current = true;
    };
  }, []);

  async function run() {
    if (runningRef.current) return;
    runningRef.current = true;
    stopped.current = false;
    setRunning(true);
    setFinished(false);
    setError(null);
    setAt(null);

    let index = 0;
    let total = Number.POSITIVE_INFINITY;
    while (index < total) {
      if (stopped.current) return;
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      const body = await response.json().catch(() => null);
      if (stopped.current) return;
      if (!response.ok) {
        setError(typeof body?.error === "string" ? body.error : "The replay stopped.");
        runningRef.current = false;
        setRunning(false);
        return;
      }
      total = body.total;
      index = body.index + 1;
      setAt(body.at);
    }

    if (stopped.current) return;
    runningRef.current = false;
    setRunning(false);
    setFinished(true);
  }

  const clock = at ? formatClock(Date.parse(at)) : null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="w-full cursor-pointer rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
      >
        {running && clock ? `Replaying ${clock}` : "Run replay"}
      </button>
      {error ? <p className="text-xs text-red-800">{error}</p> : null}
      {finished && !running ? <p className="text-xs text-neutral-500">Replay finished.</p> : null}
    </div>
  );
}
