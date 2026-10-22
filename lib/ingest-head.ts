type IngestHead = { millId: string; end: string; at: number };

const heads = globalThis as typeof globalThis & { __ingestHeads?: Map<string, IngestHead> };

function store() {
  heads.__ingestHeads ??= new Map();
  return heads.__ingestHeads;
}

export function noteIngest(millId: string, end: string) {
  store().set(millId, { millId, end, at: Date.now() });
}

export function recentIngestEnd(millId: string, withinMs = 5000) {
  const head = store().get(millId);
  if (!head) return null;
  if (Date.now() - head.at > withinMs) return null;
  return head.end;
}
