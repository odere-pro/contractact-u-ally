"use client";

import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import { DEFAULT_FILTER, type SeverityFilter } from "@/lib/clauseFilters";
import { SEVERITY_LABEL, type Severity } from "@/lib/severity";
import { cn } from "@/lib/utils";

// Severities the rail surfaces. OK is intentionally excluded — compliant
// clauses are noise in a "what to fix" UI.
const VISIBLE_SEVERITIES: readonly Severity[] = ["critical", "medium", "low"];

interface RiskRailProps {
  readonly filter?: SeverityFilter;
  readonly onToggleSeverity?: (severity: keyof SeverityFilter) => void;
}

// Left pane: per-severity filter only. The jump-to list was removed —
// the right pane already lists clauses with click-to-expand behaviour.
export function RiskRail({ filter = DEFAULT_FILTER, onToggleSeverity }: RiskRailProps) {
  if (!onToggleSeverity) return null;

  return (
    <aside data-testid="risk-rail" aria-label="Findings index" className="flex flex-col gap-5 p-4">
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
    </aside>
  );
}
