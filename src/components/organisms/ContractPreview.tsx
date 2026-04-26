"use client";

import { useMemo, type ReactNode } from "react";

import { SectionRef } from "@/components/atoms/SectionRef";
import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import type { ClauseEvent } from "@/lib/catalog/types";
import { severityOf, sortBySeverity } from "@/lib/severity";
import { cn } from "@/lib/utils";

interface ContractPreviewProps {
  readonly ocrText: string;
  readonly clauses: readonly ClauseEvent[];
  readonly activeId: string | null;
}

// Center pane. We don't render the original PDF — pdf.js is a follow-
// up. Instead we show the OCR text with each clause's `originalText`
// snippet inline-highlighted. The render is a list of React text
// nodes; never `dangerouslySetInnerHTML`.
export function ContractPreview({ ocrText, clauses, activeId }: ContractPreviewProps) {
  const segments = useMemo(() => splitWithHighlights(ocrText, clauses), [ocrText, clauses]);

  return (
    <section
      data-testid="contract-preview"
      aria-label="Contract text with risk highlights"
      className="bg-secondary/30 max-h-[640px] overflow-y-auto p-6 text-sm leading-relaxed"
    >
      {segments.map((segment, idx) =>
        // Stable key: highlights key by clause id (unique by domain
        // contract); text segments key by their position. Keeps DOM
        // identity stable while clauses stream in.
        segment.kind === "text" ? (
          <span key={`t-${idx}`}>{segment.text}</span>
        ) : (
          <Highlight
            key={`h-${segment.clause.id}`}
            clause={segment.clause}
            active={activeId === segment.clause.id}
          />
        ),
      )}
      {segments.length === 1 && (
        <p className="text-muted-foreground italic">
          (No clause snippets found in the OCR text — the analyzer may have rephrased them.)
        </p>
      )}
    </section>
  );
}

interface HighlightProps {
  readonly clause: ClauseEvent;
  readonly active: boolean;
}

function Highlight({ clause, active }: HighlightProps): ReactNode {
  const severity = severityOf(clause);
  return (
    <mark
      id={`clause-${encodeURIComponent(clause.id)}`}
      data-severity={severity}
      className={cn(
        "rounded-sm px-1 py-0.5 ring-offset-1 transition-shadow",
        severity === "critical" && "bg-critical-soft text-critical",
        severity === "medium" && "bg-medium-soft text-medium",
        severity === "low" && "bg-low-soft text-low",
        severity === "ok" && "bg-ok-soft text-ok",
        active && "ring-foreground ring-2",
      )}
    >
      <SeverityIcon severity={severity} className="mr-1 inline size-3 align-text-bottom" />
      <SectionRef id={clause.id} className="mr-1" />
      {clause.originalText}
    </mark>
  );
}

export type Segment = { kind: "text"; text: string } | { kind: "highlight"; clause: ClauseEvent };

// Greedy match: for every clause whose snippet appears verbatim in
// the OCR text, replace the first occurrence with a highlight.
// Severity-sorted iteration means critical highlights win position
// over lower-severity overlaps. Touching ranges (idx === r.end) are
// allowed: line 92's `range.start > cursor` guard prevents the empty
// text segment that would otherwise appear between adjacent marks.
export function splitWithHighlights(
  text: string,
  clauses: readonly ClauseEvent[],
): readonly Segment[] {
  const ranges: { start: number; end: number; clause: ClauseEvent }[] = [];
  for (const clause of sortBySeverity(clauses)) {
    if (!clause.originalText) continue;
    const idx = text.indexOf(clause.originalText);
    if (idx < 0) continue;
    const end = idx + clause.originalText.length;
    if (ranges.some((r) => idx < r.end && end > r.start)) continue;
    ranges.push({ start: idx, end, clause });
  }
  ranges.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) out.push({ kind: "text", text: text.slice(cursor, range.start) });
    out.push({ kind: "highlight", clause: range.clause });
    cursor = range.end;
  }
  if (cursor < text.length) out.push({ kind: "text", text: text.slice(cursor) });
  return out;
}
