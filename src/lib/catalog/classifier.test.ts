import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { __resetCatalogCachesForTests, setDataRoot } from "./ruleLoader";
import { __resetAnthropicClientForTests } from "@/lib/anthropicClient";

let tmpRoot = "";

async function seed(root: string): Promise<void> {
  await mkdir(path.join(root, "contract-types"), { recursive: true });
  await writeFile(
    path.join(root, "contract-types", "index.json"),
    JSON.stringify([
      { id: "nl-indefinite", title: "Indefinite", jurisdiction: "nl" },
      { id: "nl-fixed", title: "Fixed term", jurisdiction: "nl" },
    ]),
  );
}

function mockAnthropicReply(text: string): void {
  // Stub the Anthropic SDK message:
  vi.doMock("@anthropic-ai/sdk", () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text }],
    });
    class MockAnthropic {
      messages = { create };
    }
    return { default: MockAnthropic };
  });
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "classifier-"));
  await seed(tmpRoot);
  setDataRoot(tmpRoot);
  __resetCatalogCachesForTests();
  __resetAnthropicClientForTests();
  vi.resetModules();
});

afterEach(async () => {
  // Per-test vi.doMock + vi.resetModules in beforeEach gives each test a
  // fresh module graph, so an explicit unmock() here is unnecessary (and
  // would be hoisted, defeating the cleanup-order intent).
  vi.resetModules();
  __resetAnthropicClientForTests();
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("classifyContract", () => {
  it("parses a valid JSON response from Claude", async () => {
    mockAnthropicReply('{"typeId":"nl-fixed","confidence":0.85,"jurisdiction":"nl"}');
    const { classifyContract: fresh } = await import("./classifier");
    const result = await fresh("Some contract text", "nl");
    expect(result.typeId).toBe("nl-fixed");
    expect(result.confidence).toBe(0.85);
    expect(result.jurisdiction).toBe("nl");
  });

  it("falls back when Claude emits non-JSON", async () => {
    mockAnthropicReply("this is not json at all");
    const { classifyContract: fresh } = await import("./classifier");
    const result = await fresh("Some contract text", "nl");
    expect(result.typeId).toBe("nl-indefinite");
    expect(result.confidence).toBe(0);
  });

  it("falls back when JSON shape fails the zod schema", async () => {
    mockAnthropicReply('{"typeId":"","confidence":2,"jurisdiction":"xx"}');
    const { classifyContract: fresh } = await import("./classifier");
    const result = await fresh("Some contract text", "nl");
    expect(result.typeId).toBe("nl-indefinite");
  });
});
