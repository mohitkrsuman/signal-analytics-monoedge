import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { WriteStream } from "node:fs";
import {
  BATCH_COUNT,
  COBBLE_STARTS,
  LOAD_STEP_END,
  LOAD_STEP_START,
  MILL_ID,
  REPLAY_START,
  SAMPLES_PER_SECOND,
  SIGNALS,
  generateBatch,
  type Batch,
  type SignalKey,
} from "./replay.mts";

const DEFAULT_FIXTURE = "simulator/fixtures/rm-01-replay.jsonl";
const INGEST_PATH = "/api/ingest";

function printPlan(): void {
  console.log(`Mill ${MILL_ID}`);
  console.log(`Replay starts at ${REPLAY_START} and lasts 10 minutes at 50 Hz.`);
  console.log(`Load step ${LOAD_STEP_START} to ${LOAD_STEP_END}.`);
  console.log(`Cobbles start at ${COBBLE_STARTS.join(" and ")}. Each lasts about 8 seconds.`);
}

function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) return "";
  return value;
}

function envValue(text: string, name: string): string | undefined {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1 || trimmed.slice(0, separator) !== name) continue;
    return trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

async function fileEnv(name: string): Promise<string | undefined> {
  if (process.env[name]) return process.env[name];
  try {
    return envValue(await readFile(".env", "utf8"), name);
  } catch {
    return undefined;
  }
}

async function ingestSecret(): Promise<string | undefined> {
  return fileEnv("INGEST_SECRET");
}

async function appUrl(argv: string[]): Promise<string> {
  const fromFlag = readFlag(argv, "--url");
  const url = fromFlag || (await fileEnv("APP_URL")) || "http://localhost:3000";
  return url.replace(/\/$/, "");
}

async function writeLine(stream: WriteStream, line: string): Promise<void> {
  if (stream.write(line)) return;
  await new Promise<void>((resolve) => {
    stream.once("drain", resolve);
  });
}

async function writeFixture(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const stream = createWriteStream(path);
  const closed = new Promise<void>((resolve, reject) => {
    stream.on("error", reject);
    stream.on("finish", resolve);
  });

  for (let batchIndex = 0; batchIndex < BATCH_COUNT; batchIndex += 1) {
    await writeLine(stream, `${JSON.stringify(generateBatch(batchIndex))}\n`);
    if ((batchIndex + 1) % 60 === 0) {
      console.log(`Wrote ${batchIndex + 1} of ${BATCH_COUNT} seconds.`);
    }
  }

  stream.end();
  await closed;
  const samples = BATCH_COUNT * SAMPLES_PER_SECOND * SIGNALS.length;
  console.log(`Wrote ${BATCH_COUNT} batches (${samples} samples) to ${path}.`);
}

async function postBatch(
  url: string,
  secret: string,
  batch: Batch,
): Promise<{ ok: boolean; missing: boolean }> {
  try {
    const response = await fetch(`${url}${INGEST_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return { ok: false, missing: true };
    if (!response.ok) {
      console.error(`Ingest rejected a batch (${response.status}): ${await response.text()}`);
      return { ok: false, missing: false };
    }
    return { ok: true, missing: false };
  } catch {
    return { ok: false, missing: true };
  }
}

function mean(batch: Batch, signal: SignalKey): number {
  const values = batch.samples.filter((sample) => sample.signal === signal);
  return values.reduce((sum, sample) => sum + sample.value, 0) / values.length;
}

function printSnapshot(label: string, batchIndex: number): void {
  const batch = generateBatch(batchIndex);
  const parts = SIGNALS.map((signal) => {
    const factor = 10 ** signal.digits;
    const value = Math.round(mean(batch, signal.key) * factor) / factor;
    return `${signal.key} ${value} ${signal.unit}`;
  });
  console.log(`${label}: ${parts.join(", ")}`);
}

function printCheckpoints(): void {
  printSnapshot("Normal at 10:02:00", 120);
  printSnapshot("Load step at 10:05:00", 300);
  printSnapshot("Cobble at 10:06:34", 394);
  printSnapshot("Cobble at 10:08:34", 514);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const known = new Set(["--fixture", "--url", "--realtime"]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    if (!known.has(arg)) {
      console.error(`Unknown flag ${arg}`);
      process.exit(1);
    }
    if (arg !== "--realtime" && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      index += 1;
    }
  }

  printPlan();
  printCheckpoints();

  const fixtureFlag = readFlag(argv, "--fixture");
  if (fixtureFlag !== undefined) {
    await writeFixture(fixtureFlag || DEFAULT_FIXTURE);
    return;
  }

  const secret = await ingestSecret();
  const url = await appUrl(argv);
  if (!secret) {
    console.log("INGEST_SECRET is not set. Writing a local fixture until ingest can be called.");
    await writeFixture(DEFAULT_FIXTURE);
    return;
  }

  for (let batchIndex = 0; batchIndex < BATCH_COUNT; batchIndex += 1) {
    const result = await postBatch(url, secret, generateBatch(batchIndex));
    if (result.missing) {
      console.log(`Ingest is not available at ${url}${INGEST_PATH}. Writing a local fixture.`);
      await writeFixture(DEFAULT_FIXTURE);
      return;
    }
    if (!result.ok) process.exit(1);
    if ((batchIndex + 1) % 60 === 0) {
      console.log(`Posted ${batchIndex + 1} of ${BATCH_COUNT} seconds.`);
    }
    if (argv.includes("--realtime") && batchIndex < BATCH_COUNT - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`Posted ${BATCH_COUNT} batches to ${url}${INGEST_PATH}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
