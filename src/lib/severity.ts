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

// Per-severity Tailwind class slices used across the UI. Single source of
// truth so a token rename never leaves three component files out of sync.
// Keep in lockstep with the cva variants on `Badge` (src/components/ui/badge.tsx).
//
// Slice meanings:
//   icon    — text color for the bare glyph (atoms/SeverityIcon)
//   tint    — soft background fill at 55% alpha (molecules/ClauseCard)
//   leftBar — solid 4px border-left swatch (molecules/ClauseCard)
//   badge   — pill background + readable foreground (molecules/ClauseCard)
//   mark    — inline highlight using the bg-{sev}-soft / text-{sev}
//             token utilities (organisms/ContractPreview)
export interface SeverityClassnames {
  readonly icon: string;
  readonly tint: string;
  readonly leftBar: string;
  readonly badge: string;
  readonly mark: string;
}

export const SEVERITY_CLASSNAMES: Record<Severity, SeverityClassnames> = {
  critical: {
    icon: "text-[var(--color-critical)]",
    tint: "bg-[var(--color-critical-soft)]/55",
    leftBar: "border-l-[var(--color-critical)]",
    badge: "bg-[var(--color-critical)] text-white",
    mark: "bg-critical-soft text-critical",
  },
  medium: {
    icon: "text-[var(--color-medium)]",
    tint: "bg-[var(--color-medium-soft)]/55",
    leftBar: "border-l-[var(--color-medium)]",
    badge: "bg-[var(--color-medium)] text-white",
    mark: "bg-medium-soft text-medium",
  },
  low: {
    icon: "text-[var(--color-low)]",
    tint: "bg-[var(--color-low-soft)]/55",
    leftBar: "border-l-[var(--color-low)]",
    // Low severity uses a pale background, so white text would fail
    // contrast — keep it on the foreground token instead.
    badge: "bg-[var(--color-low)] text-[var(--color-foreground)]",
    mark: "bg-low-soft text-low",
  },
  ok: {
    icon: "text-[var(--color-ok)]",
    tint: "bg-[var(--color-ok-soft)]/55",
    leftBar: "border-l-[var(--color-ok)]",
    badge: "bg-[var(--color-ok)] text-white",
    mark: "bg-ok-soft text-ok",
  },
};

export function severityClassnames(severity: Severity): SeverityClassnames {
  return SEVERITY_CLASSNAMES[severity];
}
