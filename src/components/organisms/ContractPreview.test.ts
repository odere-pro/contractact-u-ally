import { describe, expect, it } from "vitest";

import type { ClauseEvent, ClauseStatus } from "@/lib/catalog/types";
import { splitWithHighlights } from "@/components/organisms/ContractPreview";

function clause(
  id: string,
  originalText: string,
  status: ClauseStatus = "exploitative",
): ClauseEvent {
  return {
    type: "clause",
    id,
    title: id,
    status,
    originalText,
    explanation: "",
    citation: null,
    action: null,
    permitConflict: null,
  };
}

describe("splitWithHighlights", () => {
  it("returns the whole text as one segment when there are no clauses", () => {
    const result = splitWithHighlights("hello world", []);
    expect(result).toEqual([{ kind: "text", text: "hello world" }]);
  });

  it("ignores clauses whose snippet does not appear", () => {
    const result = splitWithHighlights("foo", [clause("§1", "bar")]);
    expect(result).toEqual([{ kind: "text", text: "foo" }]);
  });

  it("splits text around a single highlight", () => {
    const result = splitWithHighlights("a foo b", [clause("§1", "foo")]);
    expect(result.map((s) => s.kind)).toEqual(["text", "highlight", "text"]);
  });

  it("emits no empty text segment between touching highlights", () => {
    // Critical first (sorted), then exploitative — touching boundary at index 5.
    const text = "abcdeXYZfg";
    const c1 = clause("§1", "abcde", "illegal");
    const c2 = clause("§2", "XYZ", "exploitative");
    const result = splitWithHighlights(text, [c1, c2]);
    // Expected: highlight(§1) | highlight(§2) | text("fg")
    expect(result.map((s) => s.kind)).toEqual(["highlight", "highlight", "text"]);
    expect(result.find((s) => s.kind === "text" && s.text === "")).toBeUndefined();
  });

  it("drops a clause whose snippet overlaps an already-placed range", () => {
    // Both clauses claim overlapping ranges; severity-sorted, illegal wins.
    const text = "abcdef";
    const winner = clause("§1", "abcd", "illegal");
    const loser = clause("§2", "bcde", "exploitative");
    const result = splitWithHighlights(text, [winner, loser]);
    const highlights = result.filter((s) => s.kind === "highlight");
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({ kind: "highlight", clause: { id: "§1" } });
  });
});
