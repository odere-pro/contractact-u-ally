"use client";

import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";

import { ClauseCard } from "@/components/molecules/ClauseCard";
import { Card, CardContent } from "@/components/ui/card";
import { DEFAULT_FILTER, applySeverityFilter, type SeverityFilter } from "@/lib/clauseFilters";
import { MIGRANT_WORKER_LABEL, MIGRANT_WORKER_TAGLINE } from "@/lib/profileCopy";
import { sortBySeverity } from "@/lib/severity";
import type { ClauseEvent, SummaryEvent } from "@/lib/catalog/types";

interface SimplifiedPaneProps {
  readonly clauses: readonly ClauseEvent[];
  readonly summary: SummaryEvent | null;
  readonly filter?: SeverityFilter;
  readonly activeId?: string | null;
  readonly onSelectClause?: (id: string) => void;
  readonly onShowWhy?: (clause: ClauseEvent) => void;
}

// Right pane. The active clause is pinned at the top; cards start
// collapsed and the user opens what they want to read. When the
// analysis returns nothing concerning we render the "all clear" panel
// instead.
export function SimplifiedPane({
  clauses,
  summary,
  filter = DEFAULT_FILTER,
  activeId = null,
  onSelectClause,
  onShowWhy,
}: SimplifiedPaneProps) {
  const visible = sortBySeverity(applySeverityFilter(clauses, filter));
  const ordered = useMemo(() => pinActive(visible, activeId), [visible, activeId]);
  const allClear =
    summary !== null && summary.illegalCount === 0 && summary.exploitativeCount === 0;

  return (
    <section
      data-testid="simplified-pane"
      aria-label="Plain-language explanation"
      className="flex flex-col gap-3 p-4"
    >
      <header className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
          For you · {MIGRANT_WORKER_LABEL}
        </span>
        <p className="text-muted-foreground text-xs leading-relaxed">{MIGRANT_WORKER_TAGLINE}</p>
      </header>

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

// Move the active clause to position 0 if it's in the visible set.
// Keeps the rest of the order intact so the user's mental map of
// "critical first, then medium, …" is preserved underneath.
export function pinActive(
  clauses: readonly ClauseEvent[],
  activeId: string | null,
): readonly ClauseEvent[] {
  if (!activeId) return clauses;
  const idx = clauses.findIndex((c) => c.id === activeId);
  if (idx <= 0) return clauses;
  return [clauses[idx], ...clauses.slice(0, idx), ...clauses.slice(idx + 1)];
}
