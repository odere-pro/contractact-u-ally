import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { runRiskPipeline } from "./runRiskPipeline";
import { __resetPromptCachesForTests, setPromptDataRoot } from "./prompts";
import { __resetCatalogCachesForTests, setDataRoot } from "@/lib/catalog/ruleLoader";
import { __resetRateLimitForTests } from "@/lib/rateLimit";

let tmpRoot = "";

async function seed(root: string): Promise<void> {
  await mkdir(path.join(root, "contract-types"), { recursive: true });
  await mkdir(path.join(root, "labor-contracts"), { recursive: true });
  await mkdir(path.join(root, "risk-examples"), { recursive: true });

  await writeFile(
    path.join(root, "contract-types", "index.json"),
    JSON.stringify([{ id: "nl-test", title: "Test contract", jurisdiction: "nl" }]),
  );
  await writeFile(
    path.join(root, "contract-types", "nl-test.json"),
    JSON.stringify({
      id: "nl-test",
      title: "Test contract",
      jurisdiction: "nl",
      applicable_rule_ids: ["rule-a"],
      mandatory_clauses: [],
      red_flag_ids: [],
    }),
  );
  await writeFile(
    path.join(root, "nl-labor-law.json"),
    JSON.stringify({
      jurisdiction: "nl",
      source: "nl-labor-law.json",
      rules: [
        {
          id: "rule-a",
          article: "BW 1:1",
          label: "Test rule",
          category: "test",
          summary: "summary",
          tags: ["t"],
        },
      ],
    }),
  );
  await writeFile(
    path.join(root, "labor-contracts", "red-flag-clauses.json"),
    JSON.stringify({ clauses: [] }),
  );
  await writeFile(path.join(root, "risk-examples", "red.md"), "# red");
  await writeFile(path.join(root, "risk-examples", "amber.md"), "# amber");
  await writeFile(path.join(root, "risk-examples", "green.md"), "# green");
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "pipeline-"));
  await seed(tmpRoot);
  setDataRoot(tmpRoot);
  setPromptDataRoot(tmpRoot);
  __resetCatalogCachesForTests();
  __resetPromptCachesForTests();
  __resetRateLimitForTests();
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

async function readNdjson(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const reader = stream.getReader();
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

const validClause = JSON.stringify({
  type: "clause",
  id: "trial-period",
  title: "Trial period",
  status: "illegal",
  originalText: "The trial period is six months.",
  explanation: "Six months exceeds the BW 7:652 cap of two months.",
  citation: { article: "BW 7:652", label: "Trial period cap", source: "nl-labor-law.json" },
  action: "Ask employer to reduce trial period to two months.",
  permitConflict: null,
  riskMappings: [{ risk: "red", path: "nl-labor-law.json/rule-a", category: "contract-terms" }],
});

const validSummary = JSON.stringify({
  type: "summary",
  jurisdiction: "nl",
  contractType: "nl-test",
  detectedLanguage: "nl",
  totalClauses: 1,
  illegalCount: 1,
  exploitativeCount: 0,
  permitConflictCount: 0,
  uncheckedCount: 0,
  compliantCount: 0,
});

describe("runRiskPipeline", () => {
  it("emits stage events, then valid clauses, then summary", async () => {
    const stream = runRiskPipeline({
      ocrText: "x".repeat(300),
      typeId: "nl-test",
      jurisdiction: "nl",
      textStreamFactory: async function* () {
        yield validClause + "\n";
        yield validSummary + "\n";
      },
    });

    const events = (await readNdjson(stream)) as { type: string }[];
    const types = events.map((e) => e.type);
    expect(types).toEqual([
      "stage", // classify 0
      "stage", // classify 1
      "stage", // load_rules 0
      "stage", // load_rules 1
      "stage", // analyze 0
      "clause",
      "summary",
    ]);
  });

  it("drops malformed lines silently and keeps streaming", async () => {
    const stream = runRiskPipeline({
      ocrText: "x".repeat(300),
      typeId: "nl-test",
      jurisdiction: "nl",
      textStreamFactory: async function* () {
        yield "not json\n";
        yield validClause + "\n";
        yield '{"type":"clause"}\n'; // missing required fields
        yield validSummary + "\n";
      },
    });

    const events = (await readNdjson(stream)) as { type: string }[];
    expect(events.filter((e) => e.type === "clause")).toHaveLength(1);
    expect(events.filter((e) => e.type === "summary")).toHaveLength(1);
  });

  it("flushes a final fragment that has no trailing newline", async () => {
    const stream = runRiskPipeline({
      ocrText: "x".repeat(300),
      typeId: "nl-test",
      jurisdiction: "nl",
      textStreamFactory: async function* () {
        yield validClause + "\n";
        yield validSummary; // no trailing \n
      },
    });
    const events = (await readNdjson(stream)) as { type: string }[];
    expect(events.filter((e) => e.type === "summary")).toHaveLength(1);
  });

  it("emits an error event when the text stream throws", async () => {
    const stream = runRiskPipeline({
      ocrText: "x".repeat(300),
      typeId: "nl-test",
      jurisdiction: "nl",
      textStreamFactory: async function* () {
        yield validClause + "\n";
        throw new Error("upstream blew up");
      },
    });
    const events = (await readNdjson(stream)) as { type: string; message?: string }[];
    const errs = events.filter((e) => e.type === "error");
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toBe("upstream blew up");
  });
});
