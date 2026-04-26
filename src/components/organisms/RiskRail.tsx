"use client";

import { Separator } from "@/components/ui/separator";
import { RiskJumpRow } from "@/components/molecules/RiskJumpRow";
import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import {
  ALL_SEVERITIES_SHOWN,
  applySeverityFilter,
  countBySeverity,
  type SeverityFilter,
} from "@/lib/clauseFilters";
import { SEVERITY_LABEL, SEVERITY_ORDER, severityOf, sortBySeverity } from "@/lib/severity";
import type { ClauseEvent } from "@/lib/catalog/types";

interface RiskRailProps {
  readonly clauses: readonly ClauseEvent[];
  readonly activeId: string | null;
  readonly filter?: SeverityFilter;
  readonly onSelectClause: (id: string) => void;
  readonly onToggleSeverity?: (severity: keyof SeverityFilter) => void;
}

// Left pane: severity counts + jump list + per-severity filter.
// Counts use unfiltered clauses so the filter UI can show "(0 of 12)"
// patterns without extra plumbing.
export function RiskRail({
  clauses,
  activeId,
  filter = ALL_SEVERITIES_SHOWN,
  onSelectClause,
  onToggleSeverity,
}: RiskRailProps) {
  const counts = countBySeverity(clauses);
  const visibleSorted = sortBySeverity(applySeverityFilter(clauses, filter));

  return (
    <aside data-testid="risk-rail" aria-label="Findings index" className="flex flex-col gap-5 p-4">
      <section className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Summary
        </h3>
        <ul className="flex flex-col gap-1">
          {SEVERITY_ORDER.map((sev) => (
            <li
              key={sev}
              className="bg-secondary/40 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <SeverityIcon severity={sev} className="size-3.5" />
              <span>{SEVERITY_LABEL[sev]}</span>
              <span className="ml-auto font-semibold">{counts[sev]}</span>
            </li>
          ))}
        </ul>
      </section>
      <Separator />
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
            {SEVERITY_ORDER.map((sev) => (
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
                {SEVERITY_LABEL[sev]}
              </label>
            ))}
          </section>
        </>
      )}
    </aside>
  );
}
