// Severity model — the visual axis the FE renders. Domain status comes
// from the BE pipeline; severity is the FE's layered interpretation
// (color, sort order, visual prominence). Keep this map in sync with
// the cva variants on `Badge` (src/components/ui/badge.tsx) and with
// `STATUS_VARIANT` in `ClauseList`.

import type { ClauseEvent, ClauseStatus } from "@/lib/catalog/types";

export type Severity = "critical" | "medium" | "low" | "ok";

export const SEVERITY_ORDER: readonly Severity[] = ["critical", "medium", "low", "ok"];

export const statusToSeverity: Record<ClauseStatus, Severity> = {
  illegal: "critical",
  permit_conflict: "critical",
  exploitative: "medium",
  unchecked: "low",
  compliant: "ok",
};

export function severityOf(clause: Pick<ClauseEvent, "status">): Severity {
  return statusToSeverity[clause.status];
}

export function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

// Stable sort: critical → ok, ties broken by clause id so re-renders
// during streaming don't shuffle items the user is already reading.
export function sortBySeverity<T extends Pick<ClauseEvent, "status" | "id">>(
  clauses: readonly T[],
): readonly T[] {
  return [...clauses].sort((a, b) => {
    const rank = severityRank(severityOf(a)) - severityRank(severityOf(b));
    if (rank !== 0) return rank;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

export function isHighSeverity(severity: Severity): boolean {
  return severity === "critical" || severity === "medium";
}

// User-facing labels. The `critical` severity bucket covers `illegal` and
// `permit_conflict` statuses; we surface it as "Illegal" everywhere so the
// worker sees one consistent word for "this breaks the law".
export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Illegal",
  medium: "Medium",
  low: "Low",
  ok: "OK",
};
