import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import {
  __resetCatalogCachesForTests,
  listContractTypes,
  loadRulesForType,
  setDataRoot,
} from "./ruleLoader";

let tmpRoot = "";

async function seed(root: string): Promise<void> {
  await mkdir(path.join(root, "contract-types"), { recursive: true });
  await mkdir(path.join(root, "labor-contracts"), { recursive: true });

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
      applicable_rule_ids: ["rule-a", "rule-missing"],
      mandatory_clauses: [{ id: "salary", description: "Gross salary" }],
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
          summary: "A summary",
          tags: ["t"],
        },
      ],
    }),
  );
  await writeFile(
    path.join(root, "labor-contracts", "red-flag-clauses.json"),
    JSON.stringify({ clauses: [] }),
  );
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "ruleloader-"));
  await seed(tmpRoot);
  setDataRoot(tmpRoot);
  __resetCatalogCachesForTests();
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("ruleLoader", () => {
  it("loads contract type spec + applicable rules and drops missing rule ids", async () => {
    const set = await loadRulesForType("nl-test", "nl");
    expect(set.contractType).toBe("nl-test");
    expect(set.applicableRules.map((r) => r.id)).toEqual(["rule-a"]);
    expect(set.mandatoryClauses).toHaveLength(1);
    expect(set.redFlags).toEqual([]);
  });

  it("reads index.json once and returns the same array on second call", async () => {
    const a = await listContractTypes();
    const b = await listContractTypes();
    expect(a).toBe(b);
    expect(a.map((t) => t.id)).toEqual(["nl-test"]);
  });

  it("rejects malformed ruleset JSON via zod", async () => {
    await writeFile(path.join(tmpRoot, "nl-labor-law.json"), JSON.stringify({ bogus: true }));
    __resetCatalogCachesForTests();
    await expect(loadRulesForType("nl-test", "nl")).rejects.toThrow();
  });
});
