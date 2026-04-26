"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { SectionRef } from "@/components/atoms/SectionRef";
import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import type { ClauseEvent } from "@/lib/catalog/types";
import { clauseMarkId } from "@/lib/clauseDom";
import { severityOf, sortBySeverity } from "@/lib/severity";
import { cn } from "@/lib/utils";

interface ContractPreviewProps {
  readonly ocrText: string;
  readonly clauses: readonly ClauseEvent[];
  readonly activeId: string | null;
  readonly selectionNonce?: number;
}

// Center pane. We don't render the original PDF — pdf.js is a follow-
// up. Instead we present the OCR text on a "page" card with the active
// clause highlighted inline. `whitespace-pre-wrap` is critical here:
// without it, the renderer collapsed runs of whitespace and the parent
// grid forced text to wrap per word.
export function ContractPreview({
  ocrText,
  clauses,
  activeId,
  selectionNonce = 0,
}: ContractPreviewProps) {
  const segments = useMemo(() => splitWithHighlights(ocrText, clauses), [ocrText, clauses]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Re-runs on every selection (activeId OR selectionNonce change), so
  // re-clicking the already-active clause still scrolls. We compute the
  // scroll offset against the local container rather than relying on
  // Element.scrollIntoView, which interacts unpredictably with the
  // nested overflow containers in the 3-pane layout. requestAnimationFrame
  // delays the measurement until after layout settles (e.g. when the
  // simplified pane has just expanded a card and reflowed siblings).
  useEffect(() => {
    const container = scrollRef.current;
    if (!activeId || !container) return;
    const targetId = clauseMarkId(activeId);
    const raf = requestAnimationFrame(() => {
      const el = container.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`);
      if (!el) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset =
        elRect.top - containerRect.top - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollBy({ top: offset, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [activeId, selectionNonce]);

  return (
    <section
      data-testid="contract-preview"
      aria-label="Contract text with risk highlights"
      className="flex h-full min-h-0 flex-col"
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-10 lg:py-8">
        <article
          className={cn(
            "bg-card border-border mx-auto max-w-2xl rounded-lg border p-6 shadow-sm lg:p-10",
            "text-sm leading-7 whitespace-pre-wrap",
          )}
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
            <p className="text-muted-foreground mt-4 italic">
              (No clause snippets matched the OCR text — the analyzer may have rephrased them.)
            </p>
          )}
        </article>
      </div>
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
      id={clauseMarkId(clause.id)}
      data-severity={severity}
      data-active={active || undefined}
      style={{
        transition: "box-shadow var(--duration-normal) var(--ease-out-expo)",
        ...(active ? { animation: "anchor-pulse 900ms var(--ease-out-expo)" } : {}),
      }}
      className={cn(
        "rounded-sm px-1 py-0.5 ring-offset-2",
        severity === "critical" && "bg-critical-soft text-critical",
        severity === "medium" && "bg-medium-soft text-medium",
        severity === "low" && "bg-low-soft text-low",
        severity === "ok" && "bg-ok-soft text-ok",
        active && "ring-foreground scroll-mt-12 ring-2 ring-offset-2",
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
