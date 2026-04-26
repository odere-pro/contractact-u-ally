import "server-only";

import { readFile } from "fs/promises";
import path from "path";

// Domain vocabulary file — loaded once per process.
let domainVocabCache: DomainVocab | null = null;

export interface AbbrevEntry {
  readonly abbr: string;
  readonly full: string;
  readonly en: string;
}

export interface ConceptEntry {
  readonly term: string;
  readonly en: string;
  readonly note: string;
}

export interface SpokenVariant {
  readonly spoken: string;
  readonly canonical: string;
}

export interface DomainVocab {
  readonly abbreviations: {
    readonly nl: readonly AbbrevEntry[];
    readonly se: readonly AbbrevEntry[];
  };
  readonly key_concepts: {
    readonly nl: readonly ConceptEntry[];
    readonly se: readonly ConceptEntry[];
  };
  readonly spoken_variants: readonly SpokenVariant[];
}

export type Jurisdiction = "nl" | "se";

export function normalizeJurisdiction(value: unknown): Jurisdiction {
  return value === "se" ? "se" : "nl";
}

export async function loadDomainVocab(): Promise<DomainVocab | null> {
  if (domainVocabCache) return domainVocabCache;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "domain-vocab", "labor-law-terms.json"),
      "utf-8",
    );
    domainVocabCache = JSON.parse(raw) as DomainVocab;
    return domainVocabCache;
  } catch (err) {
    console.error("Failed to load domain vocab:", err);
    return null;
  }
}

/** Test helper — drops cached vocab. */
export function __resetDomainVocabForTests(): void {
  domainVocabCache = null;
}

export function buildDomainContext(vocab: DomainVocab | null, jurisdiction: Jurisdiction): string {
  if (!vocab) return "";

  // Defensive: guard against missing keys in case the JSON file is incomplete.
  const abbrevs = (vocab.abbreviations?.[jurisdiction] ?? [])
    .map((a) => `${a.abbr} = ${a.full} (${a.en})`)
    .join("\n");
  const concepts = (vocab.key_concepts?.[jurisdiction] ?? [])
    .map((c) => `${c.term} (${c.en}): ${c.note}`)
    .join("\n");
  const spoken = (vocab.spoken_variants ?? [])
    .map((s) => `"${s.spoken}" → ${s.canonical}`)
    .join(", ");

  return `## Labor law abbreviations (${jurisdiction.toUpperCase()})
${abbrevs}

## Key concepts
${concepts}

## Spoken variants to watch for
${spoken}`;
}

export function buildReasoningPrompt(
  question: string,
  jurisdiction: Jurisdiction,
  domainContext: string,
  clauses: readonly unknown[],
): string {
  const clauseSummary =
    clauses.length > 0
      ? clauses
          .map((c) => {
            const cl = c as Record<string, unknown>;
            const citation = cl.citation as Record<string, string> | null;
            return `[${String(cl.status ?? "").toUpperCase()}] ${cl.title ?? ""}: ${cl.explanation ?? ""}${citation ? ` (${citation.article})` : ""}${cl.action ? ` → Action: ${cl.action}` : ""}`;
          })
          .join("\n")
      : "No contract analysis provided.";

  const hasContract = clauses.length > 0;

  // Single-quote escape — keeps the worker's question from breaking out
  // of the prompt's quoted-string framing or injecting instructions.
  const safeQuestion = question.replace(/"/g, "'");

  return `You are a labor law advisor helping a worker understand THEIR specific employment contract. You have access to the full clause-by-clause analysis of that contract.

SCOPE RESTRICTION: You ONLY answer questions about this specific analyzed contract and its clauses. If the worker asks about anything unrelated to this contract (e.g. general questions, other topics, other contracts), politely say: "I can only help with questions about your analyzed contract. Please ask me about a specific clause or your rights under this contract."

${domainContext}

## Contract analysis (${jurisdiction === "se" ? "Swedish" : "Dutch"} law)
${hasContract ? clauseSummary : "No contract has been analyzed yet. Ask the worker to upload and analyze their contract first."}

## Worker's question
"${safeQuestion}"

## Answer instructions
- Answer in the same language as the question (detect from the text — Dutch if Dutch words present)
- ONLY discuss clauses and issues from the analysis above — do not invent new clauses
- Reference the exact clause title and its status (ILLEGAL/EXPLOITATIVE/COMPLIANT) from the list
- Cite the relevant legal article (e.g. BW 7:652) when explaining violations
- Max 4 sentences — the response will be read aloud via text-to-speech
- End with one concrete action the worker can take right now`;
}
