import { describe, expect, it, vi } from "vitest";

import { chain } from "./chainedProvider";
import {
  TranslationUnavailableError,
  type TranslateTargetLang,
  type TranslationProvider,
} from "./provider";
import type { TranslateItem } from "./types";

function fakeProvider(
  name: string,
  impl: (
    target: TranslateTargetLang,
    items: readonly TranslateItem[],
  ) => Promise<readonly TranslateItem[]>,
): TranslationProvider {
  return { name, translate: vi.fn(impl) };
}

const ITEMS: readonly TranslateItem[] = [{ id: "ocr", text: "Hello" }];

describe("chain()", () => {
  it("returns the first provider's result when it succeeds", async () => {
    const a = fakeProvider("a", async () => [{ id: "ocr", text: "A" }]);
    const b = fakeProvider("b", async () => [{ id: "ocr", text: "B" }]);

    const result = await chain(a, b).translate("nl", ITEMS);

    expect(result).toEqual([{ id: "ocr", text: "A" }]);
    expect(a.translate).toHaveBeenCalledOnce();
    expect(b.translate).not.toHaveBeenCalled();
  });

  it("falls through to the next provider when the first throws TranslationUnavailableError", async () => {
    const a = fakeProvider("a", async () => {
      throw new TranslationUnavailableError("credits", "a");
    });
    const b = fakeProvider("b", async () => [{ id: "ocr", text: "B" }]);

    const result = await chain(a, b).translate("nl", ITEMS);

    expect(result).toEqual([{ id: "ocr", text: "B" }]);
    expect(a.translate).toHaveBeenCalledOnce();
    expect(b.translate).toHaveBeenCalledOnce();
  });

  it("rethrows TranslationUnavailableError when every provider is unavailable", async () => {
    const a = fakeProvider("a", async () => {
      throw new TranslationUnavailableError("first", "a");
    });
    const b = fakeProvider("b", async () => {
      throw new TranslationUnavailableError("last", "b");
    });

    await expect(chain(a, b).translate("nl", ITEMS)).rejects.toMatchObject({
      name: "TranslationUnavailableError",
      providerName: "b",
    });
  });

  it("propagates non-availability errors immediately without trying the next provider", async () => {
    const boom = new Error("kaboom");
    const a = fakeProvider("a", async () => {
      throw boom;
    });
    const b = fakeProvider("b", async () => [{ id: "ocr", text: "B" }]);

    await expect(chain(a, b).translate("nl", ITEMS)).rejects.toBe(boom);
    expect(b.translate).not.toHaveBeenCalled();
  });

  it("requires at least one provider", () => {
    expect(() => chain()).toThrow();
  });
});
