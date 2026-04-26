import { describe, expect, it } from "vitest";

import {
  formatEta,
  overallPercent,
  parseTrackerStage,
  stepLabel,
  stepStatus,
} from "@/components/organisms/StageTracker";

describe("parseTrackerStage", () => {
  it("treats 'done' as terminal complete state", () => {
    expect(parseTrackerStage("done")).toEqual({
      active: null,
      isError: false,
      isDone: true,
    });
  });

  it("treats bare 'error' as transport-level failure with no attribution", () => {
    expect(parseTrackerStage("error")).toEqual({
      active: null,
      isError: true,
      isDone: false,
    });
  });

  it("returns active stage for a plain stage id", () => {
    expect(parseTrackerStage("classify")).toEqual({
      active: "classify",
      isError: false,
      isDone: false,
    });
  });

  it("attributes error to the failed stage when given error:<stage>", () => {
    expect(parseTrackerStage("error:load_rules")).toEqual({
      active: "load_rules",
      isError: true,
      isDone: false,
    });
  });

  it("falls back to first stage when error suffix is unrecognized", () => {
    // Cast required: TS rejects an unknown error suffix at compile time,
    // but the runtime path must still cope with schema drift.
    const parsed = parseTrackerStage("error:bogus" as "error:ocr");
    expect(parsed).toEqual({ active: "ocr", isError: true, isDone: false });
  });
});

describe("stepStatus", () => {
  it("marks earlier stages complete and later stages pending while running", () => {
    const parsed = parseTrackerStage("load_rules");
    expect(stepStatus("ocr", parsed)).toBe("complete");
    expect(stepStatus("classify", parsed)).toBe("complete");
    expect(stepStatus("load_rules", parsed)).toBe("active");
    expect(stepStatus("analyze", parsed)).toBe("pending");
  });

  it("marks every stage complete when done", () => {
    const parsed = parseTrackerStage("done");
    expect(stepStatus("ocr", parsed)).toBe("complete");
    expect(stepStatus("analyze", parsed)).toBe("complete");
  });

  it("renders the failed stage with status='error' and earlier stages complete", () => {
    const parsed = parseTrackerStage("error:classify");
    expect(stepStatus("ocr", parsed)).toBe("complete");
    expect(stepStatus("classify", parsed)).toBe("error");
    expect(stepStatus("analyze", parsed)).toBe("pending");
  });

  it("never marks any stage active for bare error (no attribution)", () => {
    const parsed = parseTrackerStage("error");
    expect(stepStatus("ocr", parsed)).toBe("pending");
    expect(stepStatus("analyze", parsed)).toBe("pending");
  });
});

describe("overallPercent", () => {
  it("returns 0 when nothing has started", () => {
    expect(overallPercent(parseTrackerStage("error"), 0)).toBe(0);
  });

  it("returns 100 when done", () => {
    expect(overallPercent(parseTrackerStage("done"), 0.42)).toBe(100);
  });

  it("computes overall = (stageIdx + stageProgress) / 4", () => {
    // stage 'load_rules' = idx 2; progress 0.5 within → (2 + 0.5)/4 = 62.5%
    expect(overallPercent(parseTrackerStage("load_rules"), 0.5)).toBe(63);
  });

  it("clamps stage progress into [0, 1]", () => {
    expect(overallPercent(parseTrackerStage("ocr"), -1)).toBe(0);
    expect(overallPercent(parseTrackerStage("ocr"), 5)).toBe(25);
  });
});

describe("formatEta", () => {
  it("returns 'almost done' for non-positive seconds", () => {
    expect(formatEta(0)).toBe("almost done");
    expect(formatEta(-3)).toBe("almost done");
  });

  it("collapses sub-5s estimates to a single bucket", () => {
    expect(formatEta(2)).toBe("less than 5 seconds remaining");
  });

  it("rounds to the nearest 5-second bucket above 5", () => {
    expect(formatEta(12)).toBe("roughly 10 seconds remaining");
    expect(formatEta(13)).toBe("roughly 15 seconds remaining");
    expect(formatEta(38)).toBe("roughly 40 seconds remaining");
  });

  it("treats non-finite input as almost done", () => {
    expect(formatEta(Number.NaN)).toBe("almost done");
    expect(formatEta(Number.POSITIVE_INFINITY)).toBe("almost done");
  });
});

describe("stepLabel", () => {
  it("enriches the OCR step with page + word count when complete", () => {
    expect(stepLabel("ocr", "complete", { ocrPages: 8, ocrWordCount: 4212 })).toBe(
      "OCR complete (8 pages, 4,212 words)",
    );
  });

  it("singularizes 'page' when there is exactly one page", () => {
    expect(stepLabel("ocr", "complete", { ocrPages: 1, ocrWordCount: 250 })).toBe(
      "OCR complete (1 page, 250 words)",
    );
  });

  it("falls back to short label when OCR stats are unavailable", () => {
    expect(stepLabel("ocr", "complete", {})).toBe("Reading PDF");
    expect(stepLabel("ocr", "active", {})).toBe("Reading PDF…");
  });

  it("names the jurisdiction in the cross-check label when known", () => {
    expect(stepLabel("load_rules", "active", { jurisdiction: "nl" })).toBe(
      "Cross-checking against Dutch labor law…",
    );
  });

  it("falls back to generic copy when jurisdiction is unknown", () => {
    expect(stepLabel("load_rules", "active", {})).toBe("Cross-checking against labor law…");
  });

  it("appends an ellipsis only when the step is active", () => {
    expect(stepLabel("analyze", "active", {})).toBe("Drafting plain-language summary…");
    expect(stepLabel("analyze", "pending", {})).toBe("Drafting plain-language summary");
    expect(stepLabel("classify", "complete", {})).toBe("Clause segmentation");
  });
});
