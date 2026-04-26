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
// no API key, or malformed model output. The route maps it to a 503 so
// the client knows the result is degraded rather than just blank.
export class TranslationUnavailableError extends Error {
  override readonly name = "TranslationUnavailableError";

  constructor(
    message: string,
    readonly providerName: string,
  ) {
    super(message);
  }
}
