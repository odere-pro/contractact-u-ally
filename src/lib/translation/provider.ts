import "server-only";

import type { TranslateItem, UiLanguage } from "./types";

export type TranslateTargetLang = Exclude<UiLanguage, "en">;

export interface TranslationProvider {
  readonly name: string;
  translate(
    targetLang: TranslateTargetLang,
    items: readonly TranslateItem[],
  ): Promise<readonly TranslateItem[]>;
}

// Thrown when a provider cannot translate the request — credits exhausted,
// no API key, malformed model output, or no mock entries match. Chained
// providers swallow this and try the next link; the route maps it to a
// 503 so the client knows the result is degraded rather than just blank.
export class TranslationUnavailableError extends Error {
  override readonly name = "TranslationUnavailableError";

  constructor(
    message: string,
    readonly providerName: string,
  ) {
    super(message);
  }
}
