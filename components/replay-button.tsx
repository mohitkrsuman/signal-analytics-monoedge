"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { formatClock } from "@/lib/monitor";

const REPLAY_CLOCK_EVENT = "mill-replay-clock";
const REPLAY_KEY = "mill-replay";
const RESTART_KEY = "mill-replay-restart";
const REPLAY_STALE_MS = 8000;
// A live mill posts one second of samples every second.
const BATCH_INTERVAL_MS = 1000;

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
  const wake = useRef<(() => void) | null>(null);
  const screenLock = useRef<WakeLockSentinel | null>(null);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const startReplay = useRef<(restarting?: boolean) => void>(() => {});

  async function holdScreen() {
    if (screenLock.current || document.hidden || !("wakeLock" in navigator)) return;
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (stopped.current || !runningRef.current) {
        await lock.release();
        return;
      }
      screenLock.current = lock;
      lock.addEventListener("release", () => {
        if (screenLock.current === lock) screenLock.current = null;
      });
    } catch {
      screenLock.current = null;
    }
  }

  async function dropScreen() {
    const lock = screenLock.current;
    screenLock.current = null;
    try {
      await lock?.release();
    } catch {
      // The browser releases this lock itself when the page is hidden.
    }
  }

  useEffect(() => {
    setRemote(readReplay());

    function onStorage(event: StorageEvent) {
      if (event.key === REPLAY_KEY) setRemote(readReplay());
      if (event.key === RESTART_KEY && runningRef.current) startReplay.current(true);
    }

    function onVisible() {
      if (document.visibilityState === "visible" && runningRef.current) void holdScreen();
    }

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      const next = readReplay();
      setRemote((current) => (sameReplay(current, next) ? current : next));
    }, 1000);
    return () => {
      stopped.current = true;
      request.current?.abort();
      wake.current?.();
      void dropScreen();
      if (runningRef.current) {
        writeReplay({ running: false, at: null, updatedAt: Date.now(), finished: false });
        runningRef.current = false;
      }
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  // Waits ms, or less if the tab becomes visible again or a restart wakes it.
  function pause(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(finish, ms);
      function finish() {
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisible);
        if (wake.current === finish) wake.current = null;
        resolve();
      }
      function onVisible() {
        if (document.visibilityState === "visible") finish();
      }
      wake.current = finish;
      document.addEventListener("visibilitychange", onVisible);
    });
  }

  async function run(restarting = false) {
    if (!restarting && (runningRef.current || replayBusy(readReplay()))) return;
    const ticket = generation.current + 1;
    generation.current = ticket;
    request.current?.abort();
    wake.current?.();
    const controller = new AbortController();
    request.current = controller;
    runningRef.current = true;
    stopped.current = false;
    setRunning(true);
    setFinished(false);
    setError(null);
    setAt(null);
    writeReplay({ running: true, at: null, updatedAt: Date.now(), finished: false });
    await holdScreen();
    if (generation.current !== ticket) return;

    let index = 0;
    let total = Number.POSITIVE_INFINITY;
    let latest: string | null = null;
    let misses = 0;
    const startedAt = Date.now();
    try {
      while (index < total) {
        if (stopped.current || generation.current !== ticket) return;
        // Batch n is due at start + n seconds. A late batch goes out at once, so the replay catches up.
        const due = startedAt + index * BATCH_INTERVAL_MS - Date.now();
        if (due > 0) {
          await pause(due);
          if (stopped.current || generation.current !== ticket) return;
        }
        writeReplay({ running: true, at: latest, updatedAt: Date.now(), finished: false });
        let response: Response;
        try {
          response = await fetch("/api/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index }),
            signal: controller.signal,
          });
        } catch {
          if (stopped.current || generation.current !== ticket) return;
          misses += 1;
          if (!document.hidden && misses > 2) {
            setError("The replay stopped.");
            runningRef.current = false;
            setRunning(false);
            writeReplay({ running: false, at: latest, updatedAt: Date.now(), finished: false });
            return;
          }
          if (misses > 1) {
            await pause(1000);
            if (stopped.current || generation.current !== ticket) return;
          }
          continue;
        }
        misses = 0;
        const body = await response.json().catch(() => null);
        if (stopped.current || generation.current !== ticket) return;
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

      if (stopped.current || generation.current !== ticket) return;
      runningRef.current = false;
      setRunning(false);
      setFinished(true);
      writeReplay({ running: false, at: latest, updatedAt: Date.now(), finished: true });
    } finally {
      if (generation.current === ticket) await dropScreen();
    }
  }

  startReplay.current = run;

  function restart() {
    try {
      localStorage.setItem(RESTART_KEY, String(Date.now()));
    } catch {
      // This tab can still restart its own loop.
    }
    if (runningRef.current) void run(true);
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
        onClick={() => run()}
        disabled={running || mirrored}
        className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-60 md:min-h-0 md:py-1.5"
      >
        {running || mirrored ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
        {running || mirrored ? (clock ? `Replaying ${clock}` : "Replaying") : "Run replay"}
      </button>
      {running || mirrored ? (
        <button
          type="button"
          onClick={restart}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 md:min-h-0 md:py-1.5"
        >
          <RotateCcw aria-hidden="true" size={16} />
          Restart
        </button>
      ) : null}
      {error ? <p className="text-xs text-red-800">{error}</p> : null}
      {showFinished ? <p className="text-xs text-neutral-500">Replay finished.</p> : null}
    </div>
  );
}
