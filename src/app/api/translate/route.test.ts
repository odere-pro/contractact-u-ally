import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetRateLimitForTests } from "@/lib/rateLimit";

const url = "http://localhost:3000/api/translate";

let ipCounter = 0;
function jsonRequest(body: unknown): Request {
  ipCounter += 1;
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vercel-forwarded-for": `10.0.2.${ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  __resetRateLimitForTests();
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();
});

describe("POST /api/translate", () => {
  it("short-circuits to source items when targetLang is en (no provider call)", async () => {
    const translate = vi.fn();
    vi.doMock("@/lib/translation/providerFactory", () => ({
      getTranslationProvider: () => ({ name: "test", translate }),
    }));
    const { POST } = await import("./route");

    const res = await POST(jsonRequest({ targetLang: "en", items: [{ id: "ocr", text: "Hi" }] }));

    expect(res.status).toBe(200);
    expect(translate).not.toHaveBeenCalled();
    const body = (await res.json()) as { translations: { id: string; text: string }[] };
    expect(body.translations).toEqual([{ id: "ocr", text: "Hi" }]);
  });

  it("returns provider translations on success", async () => {
    const translate = vi.fn(async () => [{ id: "ocr", text: "Hallo" }]);
    vi.doMock("@/lib/translation/providerFactory", () => ({
      getTranslationProvider: () => ({ name: "mock", translate }),
    }));
    const { POST } = await import("./route");

    const res = await POST(
      jsonRequest({ targetLang: "nl", items: [{ id: "ocr", text: "Hello" }] }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { translations: { id: string; text: string }[] };
    expect(body.translations).toEqual([{ id: "ocr", text: "Hallo" }]);
  });

  it("returns 503 when provider throws TranslationUnavailableError", async () => {
    vi.doMock("@/lib/translation/providerFactory", () => ({
      getTranslationProvider: () => ({
        name: "fail",
        translate: async () => {
          // Re-import the real error class so `instanceof` works in route.
          const { TranslationUnavailableError } = await import("@/lib/translation/provider");
          throw new TranslationUnavailableError("credit", "anthropic");
        },
      }),
    }));
    const { POST } = await import("./route");

    const res = await POST(jsonRequest({ targetLang: "nl", items: [{ id: "ocr", text: "Hi" }] }));

    expect(res.status).toBe(503);
  });

  it("returns 502 on unexpected provider failure", async () => {
    vi.doMock("@/lib/translation/providerFactory", () => ({
      getTranslationProvider: () => ({
        name: "boom",
        translate: async () => {
          throw new Error("kaboom");
        },
      }),
    }));
    const { POST } = await import("./route");

    const res = await POST(jsonRequest({ targetLang: "nl", items: [{ id: "ocr", text: "Hi" }] }));

    expect(res.status).toBe(502);
  });

  it("rejects malformed body with 400", async () => {
    vi.doMock("@/lib/translation/providerFactory", () => ({
      getTranslationProvider: () => ({ name: "noop", translate: vi.fn() }),
    }));
    const { POST } = await import("./route");

    const res = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": "10.0.2.250" },
        body: "{not json",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("rejects oversized payloads with 413", async () => {
    vi.doMock("@/lib/translation/providerFactory", () => ({
      getTranslationProvider: () => ({ name: "noop", translate: vi.fn() }),
    }));
    const { POST } = await import("./route");

    // 200 KB cap; one big item easily exceeds it.
    const big = "x".repeat(300 * 1024);
    const res = await POST(jsonRequest({ targetLang: "nl", items: [{ id: "ocr", text: big }] }));

    expect(res.status).toBe(413);
  });
});
