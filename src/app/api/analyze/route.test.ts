import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetRateLimitForTests } from "@/lib/rateLimit";

const url = "http://localhost:3000/api/analyze";

// Minimal byte sequence that passes magic-byte validation for application/pdf
// (`%PDF-`). Tests don't run real OCR — runRiskPipeline is mocked — so the
// rest of the body can be arbitrary.
const PDF_HEAD = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

let ipCounter = 0;
function multipartRequest(file: File, fields: Record<string, string> = {}): Request {
  ipCounter += 1;
  const form = new FormData();
  form.append("file", file);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return new Request(url, {
    method: "POST",
    headers: { "x-vercel-forwarded-for": `10.0.1.${ipCounter}` },
    body: form,
  });
}

function pdfFile(): File {
  return new File([PDF_HEAD], "contract.pdf", { type: "application/pdf" });
}

async function readNdjson(res: Response): Promise<unknown[]> {
  const body = res.body;
  if (!body) throw new Error("empty body");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const out: unknown[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) out.push(JSON.parse(line));
    }
  }
  if (buf.trim()) out.push(JSON.parse(buf));
  return out;
}

beforeEach(() => {
  __resetRateLimitForTests();
  vi.resetModules();
  process.env.MISTRAL_API_KEY = "test-key";
});

afterEach(() => {
  vi.resetModules();
  delete process.env.MISTRAL_API_KEY;
});

describe("POST /api/analyze", () => {
  it("rejects non-PDF uploads with 415", async () => {
    vi.doMock("@/lib/pipeline/runRiskPipeline", () => ({
      runRiskPipeline: () => new ReadableStream(),
    }));
    const { POST } = await import("./route");
    const file = new File([PDF_HEAD], "x.txt", { type: "text/plain" });
    const res = await POST(multipartRequest(file));
    expect(res.status).toBe(415);
  });

  it("rejects when MISTRAL_API_KEY is unset with 503", async () => {
    delete process.env.MISTRAL_API_KEY;
    vi.doMock("@/lib/pipeline/runRiskPipeline", () => ({
      runRiskPipeline: () => new ReadableStream(),
    }));
    const { POST } = await import("./route");
    const res = await POST(multipartRequest(pdfFile()));
    expect(res.status).toBe(503);
  });

  it("rejects a body that is not multipart/form-data with 400", async () => {
    vi.doMock("@/lib/pipeline/runRiskPipeline", () => ({
      runRiskPipeline: () => new ReadableStream(),
    }));
    const { POST } = await import("./route");
    const req = new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": "10.0.1.99" },
      body: '{"not":"multipart"}',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns NDJSON stream with stage + clause + summary events", async () => {
    const validClause = {
      type: "clause",
      id: "trial-period",
      title: "Trial period",
      status: "illegal",
      originalText: "Six months",
      explanation: "Exceeds cap",
      citation: { article: "BW 7:652", label: "Trial period cap", source: "nl-labor-law.json" },
      action: "Reduce to 2 months",
      permitConflict: null,
      riskMappings: [],
    };
    const validSummary = {
      type: "summary",
      jurisdiction: "nl",
      contractType: "nl-indefinite",
      detectedLanguage: "nl",
      totalClauses: 1,
      illegalCount: 1,
      exploitativeCount: 0,
      permitConflictCount: 0,
      uncheckedCount: 0,
      compliantCount: 0,
    };

    vi.doMock("@/lib/pipeline/runRiskPipeline", () => ({
      runRiskPipeline: () => {
        const encoder = new TextEncoder();
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: "stage", stage: "ocr", progress: 1 }) + "\n"),
            );
            controller.enqueue(encoder.encode(JSON.stringify(validClause) + "\n"));
            controller.enqueue(encoder.encode(JSON.stringify(validSummary) + "\n"));
            controller.close();
          },
        });
      },
    }));

    const { POST } = await import("./route");
    const res = await POST(multipartRequest(pdfFile(), { typeId: "nl-indefinite" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/x-ndjson");

    const events = (await readNdjson(res)) as { type: string }[];
    const types = events.map((e) => e.type);
    expect(types).toContain("stage");
    expect(types).toContain("clause");
    expect(types).toContain("summary");
  });

  it("rejects an invalid typeId form field with 400", async () => {
    vi.doMock("@/lib/pipeline/runRiskPipeline", () => ({
      runRiskPipeline: () => new ReadableStream(),
    }));
    const { POST } = await import("./route");
    const res = await POST(multipartRequest(pdfFile(), { typeId: "../etc/passwd" }));
    expect(res.status).toBe(400);
  });

  // Regression: loadRuleset would otherwise try to read a non-existent
  // `data/<jurisdiction>-labor-law.json` and crash with ENOENT. The route
  // boundary must reject any jurisdiction other than the supported set.
  it('rejects an unsupported jurisdiction form field ("se") with 400', async () => {
    vi.doMock("@/lib/pipeline/runRiskPipeline", () => ({
      runRiskPipeline: () => new ReadableStream(),
    }));
    const { POST } = await import("./route");
    const res = await POST(multipartRequest(pdfFile(), { jurisdiction: "se" }));
    expect(res.status).toBe(400);
  });
});
