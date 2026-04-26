import { describe, expect, it } from "vitest";

import type { ClauseEvent } from "@/lib/catalog/types";
import {
  SEVERITY_CLASSNAMES,
  SEVERITY_ORDER,
  isHighSeverity,
  severityClassnames,
  severityOf,
  severityRank,
  sortBySeverity,
  statusToSeverity,
  type Severity,
} from "@/lib/severity";

function clause(id: string, status: ClauseEvent["status"]): ClauseEvent {
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

describe("severity", () => {
  it("maps every clause status to a severity bucket", () => {
    expect(statusToSeverity.illegal).toBe("critical");
    expect(statusToSeverity.permit_conflict).toBe("critical");
    expect(statusToSeverity.exploitative).toBe("medium");
    expect(statusToSeverity.unchecked).toBe("low");
    expect(statusToSeverity.compliant).toBe("ok");
  });

  it("ranks critical strictly above ok", () => {
    expect(severityRank("critical")).toBeLessThan(severityRank("ok"));
  });

  it("severityOf mirrors statusToSeverity", () => {
    expect(severityOf(clause("§1", "illegal"))).toBe("critical");
  });

  it("isHighSeverity flags critical and medium only", () => {
    expect(isHighSeverity("critical")).toBe(true);
    expect(isHighSeverity("medium")).toBe(true);
    expect(isHighSeverity("low")).toBe(false);
    expect(isHighSeverity("ok")).toBe(false);
  });

  it("sortBySeverity puts critical first, ok last, ties broken by id", () => {
    const input = [
      clause("§3", "compliant"),
      clause("§1", "illegal"),
      clause("§2", "exploitative"),
      clause("§5", "compliant"),
      clause("§4", "unchecked"),
    ];
    const sorted = sortBySeverity(input).map((c) => c.id);
    expect(sorted).toEqual(["§1", "§2", "§4", "§3", "§5"]);
  });

  it("sortBySeverity does not mutate input", () => {
    const input = [clause("§2", "compliant"), clause("§1", "illegal")];
    const before = input.map((c) => c.id);
    sortBySeverity(input);
    expect(input.map((c) => c.id)).toEqual(before);
  });

  it("SEVERITY_ORDER is exhaustive", () => {
    expect(SEVERITY_ORDER).toHaveLength(4);
  });

  describe("severityClassnames", () => {
    const SEVERITIES: readonly Severity[] = ["critical", "medium", "low", "ok"];

    it("exposes every slice for every severity", () => {
      for (const severity of SEVERITIES) {
        const classes = severityClassnames(severity);
        expect(classes.icon).toMatch(/text-/);
        expect(classes.tint).toMatch(/bg-/);
        expect(classes.leftBar).toMatch(/border-l-/);
        expect(classes.badge).toMatch(/bg-/);
        expect(classes.mark).toMatch(/bg-.+\s+text-/);
      }
    });

    it("returns the same object reference as SEVERITY_CLASSNAMES", () => {
      for (const severity of SEVERITIES) {
        expect(severityClassnames(severity)).toBe(SEVERITY_CLASSNAMES[severity]);
      }
    });

    it("uses the foreground token for low (white would fail contrast)", () => {
      expect(SEVERITY_CLASSNAMES.low.badge).toContain("text-[var(--color-foreground)]");
    });
  });
});
