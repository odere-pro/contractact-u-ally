"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";

import { ClauseCard } from "@/components/molecules/ClauseCard";
import { Card, CardContent } from "@/components/ui/card";
import { DEFAULT_FILTER, applySeverityFilter, type SeverityFilter } from "@/lib/clauseFilters";
import { sortBySeverity } from "@/lib/severity";
import type { ClauseEvent, SummaryEvent } from "@/lib/catalog/types";
import type { UseVoiceReturn } from "@/hooks/useVoice";

interface SimplifiedPaneProps {
  readonly clauses: readonly ClauseEvent[];
  readonly summary: SummaryEvent | null;
  readonly filter?: SeverityFilter;
  readonly activeId?: string | null;
  readonly selectionNonce?: number;
  readonly onSelectClause?: (id: string) => void;
  readonly onShowWhy?: (clause: ClauseEvent) => void;
  readonly voice?: UseVoiceReturn;
}

// Right pane. Cards stay sorted by severity (highest first) and never
// reorder. Each card owns its own expand/collapse state, so toggling
// one never affects the others.
export function SimplifiedPane({
  clauses,
  summary,
  filter = DEFAULT_FILTER,
  activeId = null,
  selectionNonce = 0,
  onSelectClause,
  onShowWhy,
  voice,
}: SimplifiedPaneProps) {
  const ordered = sortBySeverity(applySeverityFilter(clauses, filter));
  const allClear =
    summary !== null && summary.illegalCount === 0 && summary.exploitativeCount === 0;
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll the active card into view (without reordering) so the user
  // can see which one matches their selection in the contract pane.
  useEffect(() => {
    if (!activeId) return;
    const target = sectionRef.current?.querySelector<HTMLElement>(
      `[data-testid="clause-card-${CSS.escape(activeId)}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeId, selectionNonce]);

  return (
    <section
      ref={sectionRef}
      data-testid="simplified-pane"
      aria-label="Plain-language explanation"
      className="flex flex-col gap-3 p-4"
    >
      {allClear && (
        <Card className="border-ok border-2">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle2 aria-hidden className="text-ok size-6" />
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold">All clear</h3>
              <p className="text-sm">
                We compared every clause to the applicable labour law. Nothing in this contract
                requires your attention.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {ordered.map((clause) => (
        <ClauseCard
          key={clause.id}
          clause={clause}
          featured={clause.id === activeId}
          onSelect={onSelectClause}
          onShowWhy={onShowWhy}
          voice={voice}
        />
      ))}

      {ordered.length === 0 && !allClear && (
        <p className="text-muted-foreground text-sm">
          No clauses match the current filter. Toggle severities in the rail.
        </p>
      )}
    </section>
  );
}
