import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetRateLimitForTests } from "@/lib/rateLimit";

const url = "http://localhost:3000/api/analyze";

let ipCounter = 0;
function jsonRequest(body: unknown): Request {
  ipCounter += 1;
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vercel-forwarded-for": `10.0.1.${ipCounter}`,
    },
    body: JSON.stringify(body),
  });
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
});

afterEach(() => {
  vi.resetModules();
});

describe("POST /api/analyze", () => {
  it("rejects body with ocrText shorter than 200 chars", async () => {
    vi.doMock("@/lib/pipeline/runRiskPipeline", () => ({
      runRiskPipeline: () => new ReadableStream(),
    }));
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ ocrText: "too short" }));
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
              encoder.encode(
                JSON.stringify({ type: "stage", stage: "classify", progress: 1 }) + "\n",
              ),
            );
            controller.enqueue(encoder.encode(JSON.stringify(validClause) + "\n"));
            controller.enqueue(encoder.encode(JSON.stringify(validSummary) + "\n"));
            controller.close();
          },
        });
      },
    }));

    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ ocrText: "x".repeat(300), typeId: "nl-indefinite" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/x-ndjson");

    const events = (await readNdjson(res)) as { type: string }[];
    const types = events.map((e) => e.type);
    expect(types).toContain("stage");
    expect(types).toContain("clause");
    expect(types).toContain("summary");
  });

  it("rejects malformed JSON body", async () => {
    vi.doMock("@/lib/pipeline/runRiskPipeline", () => ({
      runRiskPipeline: () => new ReadableStream(),
    }));
    const { POST } = await import("./route");
    const req = new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": "10.0.1.99" },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
