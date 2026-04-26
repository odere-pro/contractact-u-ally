import { describe, expect, it } from "vitest";

import { mockTranslationProvider } from "./mockProvider";
import { TranslationUnavailableError } from "./provider";

describe("mockTranslationProvider", () => {
  it("translates known mock ids using the canned dictionary", async () => {
    const result = await mockTranslationProvider.translate("nl", [
      { id: "c:mock-trial-period:title", text: "Trial period (proeftijd)" },
    ]);

    expect(result).toEqual([{ id: "c:mock-trial-period:title", text: "Proeftijd" }]);
  });

  it("translates the OCR body via the 'ocr' key", async () => {
    const [translated] = await mockTranslationProvider.translate("sv", [
      { id: "ocr", text: "EMPLOYMENT CONTRACT" },
    ]);

    expect(translated.text).toContain("ANSTÄLLNINGSAVTAL");
  });

  it("throws TranslationUnavailableError when none of the ids match the dictionary", async () => {
    await expect(
      mockTranslationProvider.translate("nl", [
        { id: "c:real-clause-from-uploaded-pdf:title", text: "Some heading" },
      ]),
    ).rejects.toBeInstanceOf(TranslationUnavailableError);
  });

  it("returns source text for unknown ids when at least one id matches", async () => {
    const result = await mockTranslationProvider.translate("nl", [
      { id: "c:mock-salary:title", text: "Gross monthly salary" },
      { id: "c:unknown:title", text: "Something else" },
    ]);

    expect(result).toEqual([
      { id: "c:mock-salary:title", text: "Bruto maandsalaris" },
      { id: "c:unknown:title", text: "Something else" },
    ]);
  });
});
