import { describe, expect, it } from "vitest";

import { pinActive } from "@/components/organisms/SimplifiedPane";
import type { ClauseEvent, ClauseStatus } from "@/lib/catalog/types";

function clause(id: string, status: ClauseStatus = "exploitative"): ClauseEvent {
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

describe("pinActive", () => {
  it("returns the input unchanged when activeId is null", () => {
    const list = [clause("a"), clause("b"), clause("c")];
    expect(pinActive(list, null)).toBe(list);
  });

  it("returns the input unchanged when activeId is not in the list", () => {
    const list = [clause("a"), clause("b")];
    expect(pinActive(list, "missing")).toBe(list);
  });

  it("returns the input unchanged when active item is already at index 0", () => {
    const list = [clause("a"), clause("b")];
    expect(pinActive(list, "a")).toBe(list);
  });

  it("moves the active item to index 0 and preserves the relative order of the rest", () => {
    const list = [clause("a"), clause("b"), clause("c"), clause("d")];
    const result = pinActive(list, "c");
    expect(result.map((c) => c.id)).toEqual(["c", "a", "b", "d"]);
  });
});
