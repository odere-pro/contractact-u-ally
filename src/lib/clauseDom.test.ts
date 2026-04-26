import { describe, expect, it } from "vitest";

import { clauseMarkId } from "@/lib/clauseDom";

describe("clauseMarkId", () => {
  it("prefixes simple ids with `clause-`", () => {
    expect(clauseMarkId("simple")).toBe("clause-simple");
  });

  it("percent-encodes characters that are unsafe in DOM ids and CSS selectors", () => {
    expect(clauseMarkId("§ 3.1")).toBe("clause-%C2%A7%203.1");
  });

  it("encodes slashes so the id is a single path segment", () => {
    expect(clauseMarkId("a/b")).toBe("clause-a%2Fb");
  });
});
