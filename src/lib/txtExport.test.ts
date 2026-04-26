import { describe, expect, it } from "vitest";

import type { ClauseEvent, SummaryEvent } from "@/lib/catalog/types";
import { buildTxtReport, reportFilename } from "@/lib/txtExport";

const fixedDate = new Date("2026-04-26T12:34:56Z");

const summary: SummaryEvent = {
  type: "summary",
  jurisdiction: "nl",
  contractType: "nl-indefinite",
  detectedLanguage: "en",
  totalClauses: 3,
  illegalCount: 1,
  exploitativeCount: 1,
  permitConflictCount: 0,
  uncheckedCount: 0,
  compliantCount: 1,
};

const clauses: readonly ClauseEvent[] = [
  {
    type: "clause",
    id: "§4.2",
    title: "Probation period",
    status: "illegal",
    originalText: "9 (nine) months from start of employment",
    explanation: "Dutch law caps probation at 2 months for a 1-year contract.",
    action: "Ask for it to be reduced to 2 months in writing.",
    citation: {
      article: "BW 7:652",
      label: "Burgerlijk Wetboek 7:652",
      source: "nl-labor-law.json",
    },
    permitConflict: null,
  },
  {
    type: "clause",
    id: "§6",
    title: "Non-compete",
    status: "exploitative",
    originalText: "6 months in the same metropolitan area",
    explanation: "Legal but on the longer end. Negotiable.",
    action: null,
    citation: null,
    permitConflict: null,
  },
  {
    type: "clause",
    id: "§5",
    title: "Wages",
    status: "compliant",
    originalText: "",
    explanation: "Above legal minimum.",
    action: null,
    citation: null,
    permitConflict: null,
  },
];

describe("txtExport", () => {
  it("renders a deterministic, sorted report", () => {
    const report = buildTxtReport({
      summary,
      clauses,
      profile: "migrant_worker",
      generatedAt: fixedDate,
    });
    expect(report).toMatchSnapshot();
  });

  it("works without a summary", () => {
    const report = buildTxtReport({
      summary: null,
      clauses: [],
      profile: "student",
      generatedAt: fixedDate,
    });
    expect(report).toContain("Profile: Student");
    expect(report).not.toContain("Summary:");
  });

  it("filename contains the timestamp", () => {
    expect(reportFilename(fixedDate)).toBe("contractact-report-2026-04-26T12-34-56.txt");
  });
});
