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
      <section className="flex flex-col gap-1.5">
        <h3 className="text-muted-foreground mb-0.5 text-[10px] font-semibold tracking-widest uppercase">
          Jump to
        </h3>
        {visibleSorted.length === 0 ? (
          <p className="text-muted-foreground text-xs">No clauses match the current filter.</p>
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
      {onToggleSeverity && (
        <>
          <Separator />
          <section className="flex flex-col gap-1">
            <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
              Filter
            </h3>
            {VISIBLE_SEVERITIES.map((sev) => (
              <label
                key={sev}
                htmlFor={`severity-filter-${sev}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors select-none",
                  filter[sev]
                    ? "text-foreground hover:bg-secondary/60"
                    : "text-muted-foreground/50 hover:bg-secondary/40 hover:text-muted-foreground",
                )}
              >
                <input
                  id={`severity-filter-${sev}`}
                  type="checkbox"
                  checked={filter[sev]}
                  onChange={() => onToggleSeverity(sev)}
                  className="sr-only"
                />
                <SeverityIcon severity={sev} className="size-3.5 shrink-0" />
                <span className="font-medium">{SEVERITY_LABEL[sev]}</span>
                <span
                  aria-hidden
                  className={cn(
                    "ml-auto text-xs transition-opacity",
                    filter[sev] ? "opacity-40" : "opacity-0",
                  )}
                >
                  ✓
                </span>
              </label>
            ))}
          </section>
        </>
      )}
    </aside>
  );
}
