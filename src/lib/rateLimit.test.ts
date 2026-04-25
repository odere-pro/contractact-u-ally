import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitForTests, rateLimit } from "./rateLimit";

function makeReq(ip = "10.0.0.1"): Request {
  // x-vercel-forwarded-for is the trusted production header (set by Vercel
  // edge, stripped if client-supplied). Tests use it to drive the limiter.
  return new Request("http://localhost/test", {
    headers: { "x-vercel-forwarded-for": ip },
  });
}

describe("rateLimit", () => {
  beforeEach(() => {
    __resetRateLimitForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to capacity then denies", () => {
    const opts = { capacity: 3, refillPerSec: 0 };
    expect(rateLimit(makeReq(), "ocr", opts)).toBe(true);
    expect(rateLimit(makeReq(), "ocr", opts)).toBe(true);
    expect(rateLimit(makeReq(), "ocr", opts)).toBe(true);
    expect(rateLimit(makeReq(), "ocr", opts)).toBe(false);
  });

  it("refills tokens over time", () => {
    const opts = { capacity: 2, refillPerSec: 1 };
    expect(rateLimit(makeReq(), "ocr", opts)).toBe(true);
    expect(rateLimit(makeReq(), "ocr", opts)).toBe(true);
    expect(rateLimit(makeReq(), "ocr", opts)).toBe(false);

    vi.advanceTimersByTime(1500);
    expect(rateLimit(makeReq(), "ocr", opts)).toBe(true);
  });

  it("scopes buckets by IP", () => {
    const opts = { capacity: 1, refillPerSec: 0 };
    expect(rateLimit(makeReq("1.1.1.1"), "ocr", opts)).toBe(true);
    expect(rateLimit(makeReq("1.1.1.1"), "ocr", opts)).toBe(false);
    expect(rateLimit(makeReq("2.2.2.2"), "ocr", opts)).toBe(true);
  });

  it("scopes buckets by name", () => {
    const opts = { capacity: 1, refillPerSec: 0 };
    expect(rateLimit(makeReq(), "ocr", opts)).toBe(true);
    expect(rateLimit(makeReq(), "ocr", opts)).toBe(false);
    expect(rateLimit(makeReq(), "analyze", opts)).toBe(true);
  });

  it("falls back to x-forwarded-for then 'local' when x-vercel-forwarded-for is absent", () => {
    const opts = { capacity: 1, refillPerSec: 0 };
    const xff = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "3.3.3.3, 4.4.4.4" },
    });
    const noHdr = new Request("http://localhost/test");
    expect(rateLimit(xff, "ocr", opts)).toBe(true);
    expect(rateLimit(xff, "ocr", opts)).toBe(false);
    expect(rateLimit(noHdr, "ocr", opts)).toBe(true);
    expect(rateLimit(noHdr, "ocr", opts)).toBe(false);
  });

  it("ignores spoofed x-real-ip / x-forwarded-for when x-vercel-forwarded-for is present", () => {
    // Two requests claiming different x-forwarded-for values but the same
    // trusted x-vercel-forwarded-for must share a single bucket. This is
    // the spoofing scenario the previous header order allowed.
    const opts = { capacity: 1, refillPerSec: 0 };
    const a = new Request("http://localhost/test", {
      headers: {
        "x-vercel-forwarded-for": "5.5.5.5",
        "x-forwarded-for": "1.1.1.1",
        "x-real-ip": "1.1.1.1",
      },
    });
    const b = new Request("http://localhost/test", {
      headers: {
        "x-vercel-forwarded-for": "5.5.5.5",
        "x-forwarded-for": "2.2.2.2",
        "x-real-ip": "2.2.2.2",
      },
    });
    expect(rateLimit(a, "ocr", opts)).toBe(true);
    expect(rateLimit(b, "ocr", opts)).toBe(false);
  });
});
