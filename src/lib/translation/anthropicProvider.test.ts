import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TranslateItem } from "./types";

const items: readonly TranslateItem[] = [{ id: "ocr", text: "Hello world" }];

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();
});

describe("anthropicTranslationProvider", () => {
  it("maps a 401 SDK error to TranslationUnavailableError", async () => {
    const create = vi.fn(async () => {
      throw Object.assign(new Error("invalid x-api-key"), { status: 401 });
    });
    vi.doMock("@/lib/anthropicClient", () => ({
      getAnthropic: () => ({ messages: { create } }),
    }));

    const { anthropicTranslationProvider } = await import("./anthropicProvider");
    const { TranslationUnavailableError } = await import("./provider");

    await expect(anthropicTranslationProvider.translate("nl", items)).rejects.toBeInstanceOf(
      TranslationUnavailableError,
    );
  });

  it("maps an authentication-error message (no status) to TranslationUnavailableError", async () => {
    const create = vi.fn(async () => {
      throw new Error("authentication_error: API key not configured");
    });
    vi.doMock("@/lib/anthropicClient", () => ({
      getAnthropic: () => ({ messages: { create } }),
    }));

    const { anthropicTranslationProvider } = await import("./anthropicProvider");
    const { TranslationUnavailableError } = await import("./provider");

    await expect(anthropicTranslationProvider.translate("sv", items)).rejects.toBeInstanceOf(
      TranslationUnavailableError,
    );
  });

  it("re-throws non-credit, non-auth errors so the route returns 502", async () => {
    const create = vi.fn(async () => {
      throw new Error("kaboom");
    });
    vi.doMock("@/lib/anthropicClient", () => ({
      getAnthropic: () => ({ messages: { create } }),
    }));

    const { anthropicTranslationProvider } = await import("./anthropicProvider");
    const { TranslationUnavailableError } = await import("./provider");

    await expect(anthropicTranslationProvider.translate("nl", items)).rejects.not.toBeInstanceOf(
      TranslationUnavailableError,
    );
  });

  it("realigns translations onto the requested ids and falls back to source text on missing keys", async () => {
    const create = vi.fn(async () => ({
      content: [
        {
          type: "text",
          text: '{"translations":[{"id":"ocr","text":"Hallo wereld"}]}',
        },
      ],
    }));
    vi.doMock("@/lib/anthropicClient", () => ({
      getAnthropic: () => ({ messages: { create } }),
    }));

    const { anthropicTranslationProvider } = await import("./anthropicProvider");

    const result = await anthropicTranslationProvider.translate("nl", [
      { id: "ocr", text: "Hello world" },
      { id: "c:1:title", text: "Untranslated title" },
    ]);

    expect(result).toEqual([
      { id: "ocr", text: "Hallo wereld" },
      { id: "c:1:title", text: "Untranslated title" },
    ]);
  });
});
