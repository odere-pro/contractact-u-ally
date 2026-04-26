import { describe, expect, it } from "vitest";

import type { ClauseEvent, ClauseStatus } from "@/lib/catalog/types";
import {
  DEFAULT_FILTER,
  applySeverityFilter,
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

  it("DEFAULT_FILTER drops OK clauses but keeps everything else", () => {
    expect(applySeverityFilter(clauses, DEFAULT_FILTER).map((x) => x.id)).toEqual([
      "§1",
      "§2",
      "§3",
    ]);
  });

  it("groupBySeverity buckets by severity", () => {
    const groups = groupBySeverity(clauses);
    expect(groups.critical.map((x) => x.id)).toEqual(["§1"]);
    expect(groups.medium.map((x) => x.id)).toEqual(["§2"]);
    expect(groups.low.map((x) => x.id)).toEqual(["§3"]);
    expect(groups.ok.map((x) => x.id)).toEqual(["§4", "§5"]);
  });

  it("highestSeverity returns null when empty, else the worst present", () => {
    expect(highestSeverity([])).toBeNull();
    expect(highestSeverity([c("§9", "compliant")])).toBe("ok");
    expect(highestSeverity([c("§9", "compliant"), c("§8", "exploitative")])).toBe("medium");
    expect(highestSeverity(clauses)).toBe("critical");
  });
});
