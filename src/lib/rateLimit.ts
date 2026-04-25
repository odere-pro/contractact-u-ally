import "server-only";

// In-memory token-bucket rate limiter, scoped per process.
// Acceptable for free-tier MVP: each Vercel function instance keeps its
// own bucket, which is sufficient as a first-line abuse guard. For real
// per-user enforcement, swap this for an external store later.

interface BucketOptions {
  /** Maximum tokens that can accumulate. */
  readonly capacity: number;
  /** Refill rate in tokens per second. */
  readonly refillPerSec: number;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, BucketState>();

function clientIp(req: Request): string {
  // `x-vercel-forwarded-for` is set by Vercel's edge and stripped if the
  // client tries to supply it themselves — that's the only header we can
  // trust for per-IP rate-limiting in production. `x-forwarded-for` is a
  // local-dev fallback (and `x-real-ip` was previously trusted, which made
  // the limiter trivially bypassable by spoofing the header).
  const trusted = req.headers.get("x-vercel-forwarded-for");
  if (trusted) return trusted.split(",")[0]?.trim() || "local";
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "local";
  return "local";
}

/**
 * Try to consume one token. Returns true when the request is allowed.
 *
 * The `name` argument scopes buckets so independent endpoints don't share
 * limits (e.g. "ocr" and "analyze" each get their own token pool per IP).
 */
export function rateLimit(req: Request, name: string, opts: BucketOptions): boolean {
  const key = `${clientIp(req)}:${name}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing) {
    buckets.set(key, { tokens: opts.capacity - 1, lastRefill: now });
    return true;
  }

  const elapsedSec = (now - existing.lastRefill) / 1000;
  const refilled = Math.min(opts.capacity, existing.tokens + elapsedSec * opts.refillPerSec);
  if (refilled < 1) {
    // Persist refill progress so we don't lose accumulated tokens.
    buckets.set(key, { tokens: refilled, lastRefill: now });
    return false;
  }

  buckets.set(key, { tokens: refilled - 1, lastRefill: now });
  return true;
}

/** Test helper — drops all bucket state. Not exported via barrel. */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}
