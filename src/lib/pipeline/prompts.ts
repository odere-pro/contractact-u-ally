import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { LoadedRuleSet } from "@/lib/catalog/types";

let riskExamplesCache: { root: string; content: string } | null = null;
let dataRoot = path.join(process.cwd(), "data");

export function setPromptDataRoot(root: string): void {
  dataRoot = root;
}

export function __resetPromptCachesForTests(): void {
  riskExamplesCache = null;
}

export async function loadRiskExamples(): Promise<string> {
  if (riskExamplesCache && riskExamplesCache.root === dataRoot) {
    return riskExamplesCache.content;
  }

  const base = path.join(dataRoot, "risk-examples");
  const [red, amber, green] = await Promise.all([
    readFile(path.join(base, "red.md"), "utf-8"),
    readFile(path.join(base, "amber.md"), "utf-8"),
    readFile(path.join(base, "green.md"), "utf-8"),
  ]);

  const content = [
    `### RED examples → these clauses get status: "illegal"`,
    red,
    `### AMBER examples → these clauses get status: "exploitative"`,
    amber,
    `### GREEN examples → these clauses get status: "compliant"`,
    green,
  ].join("\n\n");

  riskExamplesCache = { root: dataRoot, content };
  return content;
}

export function buildAnalysisSystemPrompt(ruleSet: LoadedRuleSet, riskExamples: string): string {
  const rulesJson = JSON.stringify(
    ruleSet.applicableRules.map((r) => ({
      id: r.id,
      article: r.article,
      label: r.label,
      category: r.category,
      summary: r.summary,
    })),
    null,
    2,
  );

  const mandatoryJson = JSON.stringify(
    ruleSet.mandatoryClauses.map((c) => ({ id: c.id, description: c.description })),
    null,
    2,
  );

  const redFlagsJson = JSON.stringify(
    ruleSet.redFlags.map((f) => ({
      id: f.id,
      riskLevel: f.riskLevel,
      category: f.category,
      heading: f.heading,
      plain_english: f.plain_english,
    })),
    null,
    2,
  );

  return `You are a Dutch labour-law compliance analyst for contract-u-ally. You analyze employment contracts clause by clause and emit machine-readable JSON events.

## Output format

Emit EXACTLY ONE JSON object per line. No markdown. No prose outside JSON. ONLY JSON lines.

For each clause analyzed, emit a ClauseEvent:
{"type":"clause","id":"<kebab-case-slug>","title":"<clause title>","status":"<illegal|exploitative|compliant|permit_conflict>","originalText":"<verbatim text from the contract, max 300 chars>","explanation":"<plain English for the worker — what this clause means and why it matters>","citation":{"article":"<law article>","label":"<rule label>","source":"${ruleSet.contractType.startsWith("nl-") ? "nl-labor-law.json" : "labor-law.json"}"},"action":"<concrete next step for the worker, or null if compliant>","permitConflict":null,"riskMappings":[{"risk":"<red|amber|green>","path":"<source>/<ruleId>","category":"<category>"}]}

riskMappings rules:
- Include one entry per rule or red-flag that applies to this clause. A clause can violate multiple rules.
- risk: "red" for illegal violations, "amber" for exploitative/grey-zone, "green" for compliant clauses.
- path: combine the rule source file and rule id, e.g. "nl-labor-law.json/nl-trial-period-cap".
- category: use the category field from the matching rule.

After ALL clauses, emit exactly ONE SummaryEvent:
{"type":"summary","jurisdiction":"nl","contractType":"${ruleSet.contractType}","detectedLanguage":"<BCP-47 inferred from contract language>","totalClauses":<n>,"illegalCount":<n>,"exploitativeCount":<n>,"permitConflictCount":<n>,"uncheckedCount":<n>,"compliantCount":<n>}

## Calibration examples — how to classify clauses

${riskExamples}

## Applicable rules for this contract type: ${ruleSet.contractTypeTitle}

${rulesJson}

## Red-flag clause patterns to watch for

${redFlagsJson}

## Mandatory clauses that MUST be present in this contract type

${mandatoryJson}

## Instructions

1. Read the entire contract carefully.
2. For each significant clause (salary, hours, trial period, non-compete, notice, leave, dismissal, etc.), emit one ClauseEvent.
3. If a MANDATORY clause from the list above is completely absent from the contract, emit a ClauseEvent with:
   - id: "missing-<mandatory-clause-id>"
   - status: "illegal"
   - originalText: ""
   - explanation: "This mandatory clause is absent from the contract. Dutch law requires it."
   - citation: the most relevant rule from the applicable rules list, or null
4. Set "citation" to the matching rule when flagging illegal/exploitative clauses. Use null for compliant clauses unless helpful.
5. Set "action" to a concrete instruction for the worker for non-compliant clauses. Set to null for compliant clauses.
6. Status meanings:
   - "illegal": violates a specific Dutch law — void and reportable
   - "exploitative": legal but unfair or misleading
   - "compliant": appears to comply with applicable law
   - "permit_conflict": conflicts with the worker's visa/permit type
7. Emit the SummaryEvent last with accurate counts matching the ClauseEvents you emitted.
8. Infer detectedLanguage from the contract language (nl=Dutch, en=English, etc.).`;
}
