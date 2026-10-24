"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatClock } from "@/lib/monitor";

const REPLAY_CLOCK_EVENT = "mill-replay-clock";
const REPLAY_KEY = "mill-replay";
const REPLAY_STALE_MS = 8000;

type ReplayNote = {
  running: boolean;
  at: string | null;
  updatedAt: number;
  finished: boolean;
};

function readReplay(): ReplayNote | null {
  try {
    const raw = localStorage.getItem(REPLAY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReplayNote>;
    if (typeof parsed.updatedAt !== "number" || typeof parsed.running !== "boolean") return null;
    return {
      running: parsed.running,
      at: typeof parsed.at === "string" ? parsed.at : null,
      updatedAt: parsed.updatedAt,
      finished: parsed.finished === true,
    };
  } catch {
    return null;
  }
}

function writeReplay(note: ReplayNote) {
  try {
    localStorage.setItem(REPLAY_KEY, JSON.stringify(note));
  } catch {
    // This tab still runs the replay. Other tabs keep their own button.
  }
}

function replayBusy(note: ReplayNote | null) {
  return Boolean(note?.running && Date.now() - note.updatedAt < REPLAY_STALE_MS);
}

function sameReplay(left: ReplayNote | null, right: ReplayNote | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.running === right.running &&
    left.at === right.at &&
    left.finished === right.finished &&
    replayBusy(left) === replayBusy(right)
  );
}

export function ReplayButton() {
  const [running, setRunning] = useState(false);
  const [at, setAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [remote, setRemote] = useState<ReplayNote | null>(null);
  const stopped = useRef(false);
  const runningRef = useRef(false);

  useEffect(() => {
    setRemote(readReplay());

    function onStorage(event: StorageEvent) {
      if (event.key !== REPLAY_KEY) return;
      setRemote(readReplay());
    }

    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(() => {
      const next = readReplay();
      setRemote((current) => (sameReplay(current, next) ? current : next));
    }, 1000);
    return () => {
      stopped.current = true;
      if (runningRef.current) {
        writeReplay({ running: false, at: null, updatedAt: Date.now(), finished: false });
        runningRef.current = false;
      }
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, []);

  async function run() {
    if (runningRef.current || replayBusy(readReplay())) return;
    runningRef.current = true;
    stopped.current = false;
    setRunning(true);
    setFinished(false);
    setError(null);
    setAt(null);
    writeReplay({ running: true, at: null, updatedAt: Date.now(), finished: false });

    let index = 0;
    let total = Number.POSITIVE_INFINITY;
    let latest: string | null = null;
    while (index < total) {
      if (stopped.current) return;
      writeReplay({ running: true, at: latest, updatedAt: Date.now(), finished: false });
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
        writeReplay({ running: false, at: latest, updatedAt: Date.now(), finished: false });
        return;
      }
      total = body.total;
      index = body.index + 1;
      if (typeof body.at === "string") {
        latest = body.at;
        setAt(body.at);
        writeReplay({ running: true, at: body.at, updatedAt: Date.now(), finished: false });
        window.dispatchEvent(new CustomEvent(REPLAY_CLOCK_EVENT, { detail: body.at }));
      }
    }

    if (stopped.current) return;
    runningRef.current = false;
    setRunning(false);
    setFinished(true);
    writeReplay({ running: false, at: latest, updatedAt: Date.now(), finished: true });
  }

  const mirrored = !running && replayBusy(remote);
  const clockSource = running ? at : mirrored ? remote?.at : null;
  const clock = clockSource ? formatClock(Date.parse(clockSource)) : null;
  const remoteFinished =
    remote?.finished === true && Date.now() - remote.updatedAt < 60_000;
  const showFinished = !running && !mirrored && (finished || remoteFinished);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={running || mirrored}
        className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-60 md:min-h-0 md:py-1.5"
      >
        {running || mirrored ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
        {running || mirrored ? (clock ? `Replaying ${clock}` : "Replaying") : "Run replay"}
      </button>
      {error ? <p className="text-xs text-red-800">{error}</p> : null}
      {showFinished ? <p className="text-xs text-neutral-500">Replay finished.</p> : null}
    </div>
  );
}
