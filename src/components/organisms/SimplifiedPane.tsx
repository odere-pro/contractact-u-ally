"use client";

import { CheckCircle2 } from "lucide-react";

import { ClauseCard } from "@/components/molecules/ClauseCard";
import { Card, CardContent } from "@/components/ui/card";
import {
  ALL_SEVERITIES_SHOWN,
  applySeverityFilter,
  highestSeverity,
  type SeverityFilter,
} from "@/lib/clauseFilters";
import { PROFILE_LABEL, PROFILE_TAGLINE, type Profile } from "@/lib/profileCopy";
import { sortBySeverity } from "@/lib/severity";
import type { ClauseEvent, SummaryEvent } from "@/lib/catalog/types";

interface SimplifiedPaneProps {
  readonly clauses: readonly ClauseEvent[];
  readonly summary: SummaryEvent | null;
  readonly profile: Profile;
  readonly filter?: SeverityFilter;
  readonly onShowWhy?: (clause: ClauseEvent) => void;
}

// Right pane. Featured slot pinned to the highest-severity clause;
// rest render as collapsible cards. When the analysis returns nothing
// concerning we render the "all clear" panel instead.
export function SimplifiedPane({
  clauses,
  summary,
  profile,
  filter = ALL_SEVERITIES_SHOWN,
  onShowWhy,
}: SimplifiedPaneProps) {
  const visible = sortBySeverity(applySeverityFilter(clauses, filter));
  const top = highestSeverity(clauses);
  const allClear =
    summary !== null && summary.illegalCount === 0 && summary.exploitativeCount === 0;

  return (
    <section
      data-testid="simplified-pane"
      aria-label="Plain-language explanation"
      className="flex flex-col gap-3 p-4"
    >
      <header className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        For you · {PROFILE_LABEL[profile]}
      </header>
      <p className="text-muted-foreground text-xs">{PROFILE_TAGLINE[profile]}</p>

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

      {visible.map((clause, idx) => (
        <ClauseCard
          key={clause.id}
          clause={clause}
          featured={idx === 0 && top !== null && (top === "critical" || top === "medium")}
          onShowWhy={onShowWhy}
        />
      ))}

      {visible.length === 0 && !allClear && (
        <p className="text-muted-foreground text-sm">
          No clauses match the current filter. Toggle severities in the rail.
        </p>
      )}
    </section>
  );
}
