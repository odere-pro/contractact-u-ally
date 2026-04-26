import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();
  delete process.env.ANTHROPIC_API_KEY;
});

describe("getTranslationProvider()", () => {
  it("returns the Anthropic provider", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { getTranslationProvider } = await import("./providerFactory");

    const provider = getTranslationProvider();

    expect(provider.name).toBe("anthropic");
  });
});
