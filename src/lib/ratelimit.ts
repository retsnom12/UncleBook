// Best-effort in-memory sliding-window rate limiter.
// On serverless each instance has its own memory, so this is a safety net
// against accidental floods, not a hard guarantee.

const hits = new Map<string, number[]>();
const MAX_KEYS = 5000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_KEYS) {
    // Drop the oldest half so memory can never grow without bound.
    let i = 0;
    for (const k of hits.keys()) {
      hits.delete(k);
      if (++i > MAX_KEYS / 2) break;
    }
  }
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}
