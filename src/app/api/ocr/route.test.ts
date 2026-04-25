import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { __resetRateLimitForTests } from "@/lib/rateLimit";

const url = "http://localhost:3000/api/ocr";

const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

function makePdfFile(name = "contract.pdf", size = 2048): File {
  const padding = new Uint8Array(size - PDF_HEADER.length);
  return new File([PDF_HEADER, padding], name, { type: "application/pdf" });
}

// Each test gets a fresh "client IP" so the module-level rate-limit bucket
// (capacity: 5/min) doesn't carry tokens between cases.
let ipCounter = 0;
function makeRequest(form: FormData): Request {
  ipCounter += 1;
  return new Request(url, {
    method: "POST",
    body: form,
    headers: { "x-vercel-forwarded-for": `10.0.0.${ipCounter}` },
  });
}

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_KEY = process.env.MISTRAL_API_KEY;

function mistralOk(pages: { markdown: string }[]): Response {
  return new Response(JSON.stringify({ pages }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  process.env.MISTRAL_API_KEY = "test-mistral-key";
  __resetRateLimitForTests();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env.MISTRAL_API_KEY = ORIGINAL_KEY;
  vi.restoreAllMocks();
});

describe("POST /api/ocr", () => {
  it("forwards a valid PDF to Mistral and returns extracted text", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        mistralOk([
          { markdown: "Article 1. Contract clauses follow…" },
          { markdown: "Article 2. More clauses." },
        ]),
      );

    const fd = new FormData();
    fd.append("file", makePdfFile());
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.text).toBe("Article 1. Contract clauses follow…\n\nArticle 2. More clauses.");
    expect(body.pages).toBe(2);
    expect(typeof body.durationMs).toBe("number");

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://api.mistral.ai/v1/ocr");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-mistral-key",
    );
  });

  it("returns 503 when MISTRAL_API_KEY is unset", async () => {
    delete process.env.MISTRAL_API_KEY;
    const fd = new FormData();
    fd.append("file", makePdfFile());
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(503);
  });

  it("returns 400 when the file field is missing", async () => {
    const fd = new FormData();
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(400);
  });

  it("returns 415 for non-PDF MIME types", async () => {
    const fd = new FormData();
    fd.append("file", new File(["hello"], "x.txt", { type: "text/plain" }));
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(415);
  });

  it("returns 413 when the file exceeds the size cap", async () => {
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.pdf", {
      type: "application/pdf",
    });
    const fd = new FormData();
    fd.append("file", big);
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(413);
  });

  it("returns 400 when magic bytes don't match the declared MIME", async () => {
    // Declared as PDF but contains JPEG magic — fails magic-byte check.
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const padding = new Uint8Array(2048 - jpegBytes.length);
    const fake = new File([jpegBytes, padding], "fake.pdf", { type: "application/pdf" });
    const fd = new FormData();
    fd.append("file", fake);
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(400);
  });

  it("returns 502 when Mistral returns 401", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const fd = new FormData();
    fd.append("file", makePdfFile());
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid OCR API key");
  });

  it("returns 502 when Mistral is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const fd = new FormData();
    fd.append("file", makePdfFile());
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(502);
  });

  it("returns 422 when Mistral extracts no text", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mistralOk([{ markdown: "" }]));
    const fd = new FormData();
    fd.append("file", makePdfFile());
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(422);
  });

  it("returns 502 when Mistral returns an unexpected envelope shape", async () => {
    // Schema drift — `pages` is a string instead of an array. Previously
    // the unsafe `as MistralResponse` cast let this through and silently
    // returned 422 with no diagnostic. Zod safeParse now surfaces it as 502.
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ pages: "not-an-array" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const fd = new FormData();
    fd.append("file", makePdfFile());
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("OCR service returned unexpected shape");
  });

  it("returns 429 once the rate-limit bucket is empty", async () => {
    // mockImplementation, not mockResolvedValue — Response bodies can only
    // be read once, so each call must produce a fresh Response.
    globalThis.fetch = vi.fn().mockImplementation(async () => mistralOk([{ markdown: "ok" }]));
    const sharedIp = "9.9.9.9";

    // Capacity is 5 — the 6th call from the same IP must trip.
    for (let i = 0; i < 5; i++) {
      const fd = new FormData();
      fd.append("file", makePdfFile());
      const req = new Request(url, {
        method: "POST",
        body: fd,
        headers: { "x-vercel-forwarded-for": sharedIp },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    const fd = new FormData();
    fd.append("file", makePdfFile());
    const req = new Request(url, {
      method: "POST",
      body: fd,
      headers: { "x-vercel-forwarded-for": sharedIp },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});
