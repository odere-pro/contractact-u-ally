// Build a plaintext "contract + notes" export from in-memory analysis
// state. Pure function — runs in the browser, no server call. The user
// owns the resulting Blob (they pick the filename and where to save).

import type { ClauseEvent, SummaryEvent } from "@/lib/catalog/types";
import { MIGRANT_WORKER_LABEL } from "@/lib/profileCopy";
import { SEVERITY_LABEL, severityOf, sortBySeverity } from "@/lib/severity";

interface BuildArgs {
  readonly summary: SummaryEvent | null;
  readonly clauses: readonly ClauseEvent[];
  readonly generatedAt: Date;
}

const DIVIDER = "─".repeat(64);

export function buildTxtReport(args: BuildArgs): string {
  const { summary, clauses, generatedAt } = args;
  const sorted = sortBySeverity(clauses);
  const lines: string[] = [];

  lines.push("CONTRACTACT-U-ALLY · simplified report");
  lines.push(
    `Audience: ${MIGRANT_WORKER_LABEL} · Generated: ${generatedAt.toISOString().slice(0, 10)}`,
  );
  if (summary) {
    lines.push(
      `Summary: ${summary.totalClauses} clauses · ${summary.illegalCount} illegal · ${summary.exploitativeCount} exploitative · ${summary.compliantCount} compliant`,
    );
  }
  lines.push("");

  for (const clause of sorted) {
    const severity = severityOf(clause);
    lines.push(DIVIDER);
    lines.push(`${clause.id} ${clause.title}  [${SEVERITY_LABEL[severity]}]`);
    lines.push(DIVIDER);
    if (clause.originalText) {
      lines.push(`ORIGINAL: ${quote(clause.originalText)}`);
    }
    lines.push(`EXPLANATION: ${clause.explanation}`);
    if (clause.action) lines.push(`ACTION: ${clause.action}`);
    if (clause.citation) {
      lines.push(`SOURCE: ${clause.citation.label} — ${clause.citation.article}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function quote(text: string): string {
  // Preserve paragraph breaks so the export keeps any intentional
  // structure in a clause snippet, but collapse runs of inline
  // whitespace (PDFs often contain stray double-spaces from OCR).
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
  return `"${paragraphs.join("\n\n")}"`;
}

export function reportFilename(generatedAt: Date): string {
  const stamp = generatedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `contractact-report-${stamp}.txt`;
}
