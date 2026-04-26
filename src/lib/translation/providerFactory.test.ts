import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();
  delete process.env.ANTHROPIC_API_KEY;
});

describe("getTranslationProvider()", () => {
  it("returns the bare mock provider when ANTHROPIC_API_KEY is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { getTranslationProvider } = await import("./providerFactory");

    const provider = getTranslationProvider();

    expect(provider.name).toBe("mock");
  });

  it("returns a chain (anthropic→mock) when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { getTranslationProvider } = await import("./providerFactory");

    const provider = getTranslationProvider();

    expect(provider.name).toBe("chain(anthropic→mock)");
  });
});
