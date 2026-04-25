import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  contractTypeEntrySchema,
  contractTypeSpecSchema,
  redFlagClauseSchema,
  rulesetSchema,
} from "./schemas";
import type { ContractTypeEntry, Jurisdiction, LoadedRuleSet, RedFlagClause, Rule } from "./types";

// Module-level caches — populated once per process, reused across requests.
// Each cache key includes the data root so tests with a temp DATA_ROOT don't
// collide with production data loaded by other tests in the same process.
const rulesetCache = new Map<string, readonly Rule[]>();
const redFlagCache = new Map<string, readonly RedFlagClause[]>();
const indexCache = new Map<string, readonly ContractTypeEntry[]>();
const specCache = new Map<string, ContractTypeSpecCacheEntry>();

interface ContractTypeSpecCacheEntry {
  readonly id: string;
  readonly title: string;
  readonly jurisdiction: Jurisdiction;
  readonly applicable_rule_ids: readonly string[];
  readonly mandatory_clauses: readonly { id: string; description: string }[];
  readonly red_flag_ids: readonly string[];
}

/**
 * Resolve the catalog root. Override per-test via `setDataRoot()`.
 * Defaults to `<cwd>/data`, matching the reference PR's layout.
 */
let dataRoot = path.join(process.cwd(), "data");

export function setDataRoot(root: string): void {
  dataRoot = root;
}

export function __resetCatalogCachesForTests(): void {
  rulesetCache.clear();
  redFlagCache.clear();
  indexCache.clear();
  specCache.clear();
}

async function loadRuleset(jurisdiction: Jurisdiction): Promise<readonly Rule[]> {
  const cacheKey = `${dataRoot}::${jurisdiction}`;
  const cached = rulesetCache.get(cacheKey);
  if (cached) return cached;

  const raw = await readFile(path.join(dataRoot, `${jurisdiction}-labor-law.json`), "utf-8");
  const parsed = rulesetSchema.parse(JSON.parse(raw));
  rulesetCache.set(cacheKey, parsed.rules);
  return parsed.rules;
}

async function loadRedFlags(): Promise<readonly RedFlagClause[]> {
  const cacheKey = dataRoot;
  const cached = redFlagCache.get(cacheKey);
  if (cached) return cached;

  const raw = await readFile(
    path.join(dataRoot, "labor-contracts", "red-flag-clauses.json"),
    "utf-8",
  );
  const data = JSON.parse(raw) as { clauses?: unknown };
  const clauses = Array.isArray(data.clauses)
    ? data.clauses.map((c) => redFlagClauseSchema.parse(c))
    : [];
  redFlagCache.set(cacheKey, clauses);
  return clauses;
}

async function loadSpec(typeId: string): Promise<ContractTypeSpecCacheEntry> {
  const cacheKey = `${dataRoot}::${typeId}`;
  const cached = specCache.get(cacheKey);
  if (cached) return cached;

  const raw = await readFile(path.join(dataRoot, "contract-types", `${typeId}.json`), "utf-8");
  const spec = contractTypeSpecSchema.parse(JSON.parse(raw));
  specCache.set(cacheKey, spec);
  return spec;
}

export async function loadRulesForType(
  typeId: string,
  jurisdiction: Jurisdiction,
): Promise<LoadedRuleSet> {
  const spec = await loadSpec(typeId);
  const [allRules, allRedFlags] = await Promise.all([loadRuleset(jurisdiction), loadRedFlags()]);

  const ruleIndex = new Map(allRules.map((r) => [r.id, r]));
  const applicableRules = spec.applicable_rule_ids
    .map((id) => ruleIndex.get(id))
    .filter((r): r is Rule => r !== undefined);

  const redFlagIndex = new Map(allRedFlags.map((r) => [r.id, r]));
  const redFlags = spec.red_flag_ids
    .map((id) => redFlagIndex.get(id))
    .filter((r): r is RedFlagClause => r !== undefined);

  return {
    contractType: spec.id,
    contractTypeTitle: spec.title,
    applicableRules,
    mandatoryClauses: spec.mandatory_clauses,
    redFlags,
  };
}

export async function listContractTypes(): Promise<readonly ContractTypeEntry[]> {
  const cacheKey = dataRoot;
  const cached = indexCache.get(cacheKey);
  if (cached) return cached;

  const raw = await readFile(path.join(dataRoot, "contract-types", "index.json"), "utf-8");
  const entries = (JSON.parse(raw) as unknown[]).map((e) => contractTypeEntrySchema.parse(e));
  indexCache.set(cacheKey, entries);
  return entries;
}
