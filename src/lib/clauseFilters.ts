// Pure helpers for filtering and grouping clauses in the rail and
// simplified pane. No React, no DOM — keeps the components dumb and
// the tests trivial.

import type { ClauseEvent } from "@/lib/catalog/types";
import type { Severity } from "@/lib/severity";
import { SEVERITY_ORDER, severityOf } from "@/lib/severity";

export type SeverityFilter = Record<Severity, boolean>;

export const ALL_SEVERITIES_SHOWN: SeverityFilter = {
  critical: true,
  medium: true,
  low: true,
  ok: true,
};

export const HIDE_OK: SeverityFilter = {
  critical: true,
  medium: true,
  low: true,
  ok: false,
};

export function applySeverityFilter(
  clauses: readonly ClauseEvent[],
  filter: SeverityFilter,
): readonly ClauseEvent[] {
  return clauses.filter((c) => filter[severityOf(c)]);
}

export function groupBySeverity(
  clauses: readonly ClauseEvent[],
): Record<Severity, readonly ClauseEvent[]> {
  const groups: Record<Severity, ClauseEvent[]> = {
    critical: [],
    medium: [],
    low: [],
    ok: [],
  };
  for (const clause of clauses) {
    groups[severityOf(clause)].push(clause);
  }
  return groups;
}

export function countBySeverity(clauses: readonly ClauseEvent[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, medium: 0, low: 0, ok: 0 };
  for (const clause of clauses) counts[severityOf(clause)]++;
  return counts;
}

export function highestSeverity(clauses: readonly ClauseEvent[]): Severity | null {
  if (clauses.length === 0) return null;
  for (const sev of SEVERITY_ORDER) {
    if (clauses.some((c) => severityOf(c) === sev)) return sev;
  }
  return null;
}
