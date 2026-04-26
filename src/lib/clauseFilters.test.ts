import { describe, expect, it } from "vitest";

import type { ClauseEvent, ClauseStatus } from "@/lib/catalog/types";
import {
  ALL_SEVERITIES_SHOWN,
  HIDE_OK,
  applySeverityFilter,
  countBySeverity,
  groupBySeverity,
  highestSeverity,
} from "@/lib/clauseFilters";

function c(id: string, status: ClauseStatus): ClauseEvent {
  return {
    type: "clause",
    id,
    title: id,
    status,
    originalText: "",
    explanation: "",
    citation: null,
    action: null,
    permitConflict: null,
  };
}

describe("clauseFilters", () => {
  const clauses: readonly ClauseEvent[] = [
    c("§1", "illegal"),
    c("§2", "exploitative"),
    c("§3", "unchecked"),
    c("§4", "compliant"),
    c("§5", "compliant"),
  ];

  it("applySeverityFilter drops disabled severities", () => {
    expect(applySeverityFilter(clauses, HIDE_OK).map((x) => x.id)).toEqual(["§1", "§2", "§3"]);
  });

  it("ALL_SEVERITIES_SHOWN passes everything through", () => {
    expect(applySeverityFilter(clauses, ALL_SEVERITIES_SHOWN)).toHaveLength(5);
  });

  it("groupBySeverity buckets by severity", () => {
    const groups = groupBySeverity(clauses);
    expect(groups.critical.map((x) => x.id)).toEqual(["§1"]);
    expect(groups.medium.map((x) => x.id)).toEqual(["§2"]);
    expect(groups.low.map((x) => x.id)).toEqual(["§3"]);
    expect(groups.ok.map((x) => x.id)).toEqual(["§4", "§5"]);
  });

  it("countBySeverity totals each bucket", () => {
    expect(countBySeverity(clauses)).toEqual({ critical: 1, medium: 1, low: 1, ok: 2 });
  });

  it("highestSeverity returns null when empty, else the worst present", () => {
    expect(highestSeverity([])).toBeNull();
    expect(highestSeverity([c("§9", "compliant")])).toBe("ok");
    expect(highestSeverity([c("§9", "compliant"), c("§8", "exploitative")])).toBe("medium");
    expect(highestSeverity(clauses)).toBe("critical");
  });
});
