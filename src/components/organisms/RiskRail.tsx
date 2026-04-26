"use client";

import { Separator } from "@/components/ui/separator";
import { RiskJumpRow } from "@/components/molecules/RiskJumpRow";
import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import { DEFAULT_FILTER, applySeverityFilter, type SeverityFilter } from "@/lib/clauseFilters";
import { SEVERITY_LABEL, severityOf, sortBySeverity, type Severity } from "@/lib/severity";
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
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
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
          <section className="flex flex-col gap-1.5">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Filter
            </h3>
            {VISIBLE_SEVERITIES.map((sev) => (
              <label
                key={sev}
                htmlFor={`severity-filter-${sev}`}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  id={`severity-filter-${sev}`}
                  type="checkbox"
                  checked={filter[sev]}
                  onChange={() => onToggleSeverity(sev)}
                />
                <SeverityIcon severity={sev} className="size-3.5" />
                {SEVERITY_LABEL[sev]}
              </label>
            ))}
          </section>
        </>
      )}
    </aside>
  );
}
