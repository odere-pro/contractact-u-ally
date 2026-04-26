"use client";

import { Separator } from "@/components/ui/separator";
import { RiskJumpRow } from "@/components/molecules/RiskJumpRow";
import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import { DEFAULT_FILTER, applySeverityFilter, type SeverityFilter } from "@/lib/clauseFilters";
import { SEVERITY_LABEL, severityOf, sortBySeverity, type Severity } from "@/lib/severity";
import { cn } from "@/lib/utils";
import type { ClauseEvent } from "@/lib/catalog/types";

// Severities the rail surfaces. OK is intentionally excluded — compliant
// clauses are noise in a "what to fix" UI.
const VISIBLE_SEVERITIES: readonly Severity[] = ["critical", "medium", "low"];

interface RiskRailProps {
  readonly clauses: readonly ClauseEvent[];
  readonly activeId: string | null;
  readonly filter?: SeverityFilter;
  readonly onSelectClause: (id: string) => void;
  readonly onToggleSeverity?: (severity: keyof SeverityFilter) => void;
}

// Left pane: jump list + per-severity filter. The summary count panel
// was removed — counts are visible inline in the jump list and add
// noise above the actual navigation.
export function RiskRail({
  clauses,
  activeId,
  filter = DEFAULT_FILTER,
  onSelectClause,
  onToggleSeverity,
}: RiskRailProps) {
  const visibleSorted = sortBySeverity(applySeverityFilter(clauses, filter));

  return (
    <aside data-testid="risk-rail" aria-label="Findings index" className="flex flex-col gap-5 p-4">
      {onToggleSeverity && (
        <section className="flex flex-col gap-1.5" aria-labelledby="risk-rail-filter-heading">
          <h3
            id="risk-rail-filter-heading"
            className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-widest uppercase"
          >
            Filter by severity
          </h3>
          {VISIBLE_SEVERITIES.map((sev) => (
            <label
              key={sev}
              htmlFor={`severity-filter-${sev}`}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.9375rem] transition-colors select-none",
                filter[sev]
                  ? "text-foreground hover:bg-secondary/60"
                  : "text-muted-foreground/60 hover:bg-secondary/40 hover:text-muted-foreground",
              )}
            >
              <input
                id={`severity-filter-${sev}`}
                type="checkbox"
                checked={filter[sev]}
                onChange={() => onToggleSeverity(sev)}
                className="sr-only"
              />
              <SeverityIcon severity={sev} className="size-4 shrink-0" />
              <span className="font-medium">{SEVERITY_LABEL[sev]}</span>
              <span
                aria-hidden
                className={cn(
                  "ml-auto text-sm transition-opacity",
                  filter[sev] ? "opacity-50" : "opacity-0",
                )}
              >
                ✓
              </span>
            </label>
          ))}
        </section>
      )}
      {onToggleSeverity && <Separator />}
      <section className="flex flex-col gap-2" aria-labelledby="risk-rail-jump-heading">
        <h3
          id="risk-rail-jump-heading"
          className="text-muted-foreground mb-1 text-xs font-semibold tracking-widest uppercase"
        >
          Jump to clause
        </h3>
        {visibleSorted.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            No clauses match the current filter.
          </p>
        ) : (
          <nav className="flex flex-col gap-0.5" aria-label="Clause navigation">
            {visibleSorted.map((c) => (
              <RiskJumpRow
                key={c.id}
                clauseId={c.id}
                title={c.title}
                severity={severityOf(c)}
                active={activeId === c.id}
                onSelect={onSelectClause}
              />
            ))}
          </nav>
        )}
      </section>
    </aside>
  );
}
