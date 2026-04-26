/**
 * Thin wrapper around Solvimon's billing API.
 *
 * Soft-fail policy: if Solvimon is down or slow, the user must still be able
 * to analyze their contract. `checkEntitlement` returns `{ allowed: true }`
 * on any error/timeout EXCEPT a genuine 429, which means our API key is
 * rate-limited — we must deny rather than silently grant free access.
 * `reportUsage` is fire-and-forget.
 *
 * The 3s timeout is intentional — Solvimon should not be on the hot path.
 */

const TIMEOUT_MS = 3_000;
const BASE_URL = "https://api.solvimon.com/v1";

export interface EntitlementResult {
  readonly allowed: boolean;
  /** Where to redirect the user when blocked. Solvimon-issued. */
  readonly checkoutUrl?: string;
  /** True when Solvimon rate-limited our API key (HTTP 429). */
  readonly rateLimited?: boolean;
  /** Seconds until the rate limit resets, parsed from Retry-After header. */
  readonly retryAfterSec?: number;
}

export interface UsageMetadata {
  readonly jurisdiction?: string;
  readonly typeId?: string;
  readonly contractSizeKb?: number;
  readonly illegalCount?: number;
  readonly exploitativeCount?: number;
}

export interface CustomerResult {
  readonly customerId: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("solvimon-timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

function parseRetryAfter(value: string): number | undefined {
  const asInt = parseInt(value, 10);
  if (!isNaN(asInt) && asInt >= 0) return asInt;
  const asDate = Date.parse(value);
  if (!isNaN(asDate)) return Math.max(0, Math.round((asDate - Date.now()) / 1000));
  return undefined;
}

export async function checkEntitlement(customerId: string | undefined): Promise<EntitlementResult> {
  // Anonymous flow: free-trial enforcement is handled client-side via
  // localStorage. When a customerId exists (future auth layer), check
  // Solvimon to enforce subscription limits.
  if (!customerId) return { allowed: true };

  const apiKey = process.env.SOLVIMON_API_KEY;
  if (!apiKey) {
    // Misconfigured — soft-fail to keep the demo working without billing.
    return { allowed: true };
  }

  try {
    const res = await withTimeout(
      fetch(`${BASE_URL}/entitlements?customerId=${encodeURIComponent(customerId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      TIMEOUT_MS,
    );

    // 429 = our API key is rate-limited by Solvimon. Do NOT soft-fail to
    // allowed here — that would be a billing leak. Return denied + metadata.
    if (res.status === 429) {
      const ra = res.headers.get("Retry-After");
      return {
        allowed: false,
        rateLimited: true,
        retryAfterSec: ra ? parseRetryAfter(ra) : undefined,
      };
    }

    if (!res.ok) return { allowed: true }; // soft-fail on 5xx/4xx to preserve availability
    const body = (await res.json()) as { allowed?: unknown; checkoutUrl?: unknown };
    return {
      allowed: body.allowed === true,
      checkoutUrl: typeof body.checkoutUrl === "string" ? body.checkoutUrl : undefined,
    };
  } catch {
    return { allowed: true };
  }
}

export async function reportUsage(
  customerId: string | undefined,
  metadata?: UsageMetadata,
): Promise<void> {
  if (!customerId) return;
  const apiKey = process.env.SOLVIMON_API_KEY;
  if (!apiKey) return;

  try {
    await withTimeout(
      fetch(`${BASE_URL}/usage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId,
          event: "analysis",
          quantity: 1,
          metadata: metadata ?? {},
        }),
      }),
      TIMEOUT_MS,
    );
  } catch {
    // Fire-and-forget. Usage drift is recoverable.
  }
}

/**
 * Look up an existing Solvimon customer by externalId; create one if absent.
 * Returns null on any error (soft-fail). Intended for use in a session/auth
 * layer — not on the hot path of every analysis request.
 */
export async function createOrRetrieveCustomer(
  platformId: string,
  externalId: string,
): Promise<CustomerResult | null> {
  const apiKey = process.env.SOLVIMON_API_KEY;
  if (!apiKey) return null;

  try {
    const getRes = await withTimeout(
      fetch(
        `${BASE_URL}/customers?platformId=${encodeURIComponent(platformId)}&externalId=${encodeURIComponent(externalId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      ),
      TIMEOUT_MS,
    );

    if (getRes.ok) {
      const body = (await getRes.json()) as { customerId?: unknown };
      if (typeof body.customerId === "string") return { customerId: body.customerId };
    }

    if (getRes.status !== 404) return null;

    const postRes = await withTimeout(
      fetch(`${BASE_URL}/customers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platformId, externalId }),
      }),
      TIMEOUT_MS,
    );

    if (!postRes.ok) return null;
    const created = (await postRes.json()) as { customerId?: unknown };
    return typeof created.customerId === "string" ? { customerId: created.customerId } : null;
  } catch {
    return null;
  }
}

export const __test__ = { TIMEOUT_MS, BASE_URL, parseRetryAfter };
