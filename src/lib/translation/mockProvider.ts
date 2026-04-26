import "server-only";

import { getMockTranslations, mockHasAnyMatch } from "@/lib/anthropicFallback";

import {
  TranslationUnavailableError,
  type TranslateTargetLang,
  type TranslationProvider,
} from "./provider";
import type { TranslateItem } from "./types";

const NAME = "mock";

// Serves canned NL/SV translations for the synthetic mock contract. When
// none of the inbound ids match the dictionary the provider throws so a
// chained fallback can take over (or the route can surface a 503) rather
// than silently echoing English back under an NL/SV pill.
export const mockTranslationProvider: TranslationProvider = {
  name: NAME,
  async translate(
    targetLang: TranslateTargetLang,
    items: readonly TranslateItem[],
  ): Promise<readonly TranslateItem[]> {
    if (!mockHasAnyMatch(items)) {
      throw new TranslationUnavailableError("No mock translations available for these items", NAME);
    }
    return getMockTranslations(targetLang, items);
  },
};
