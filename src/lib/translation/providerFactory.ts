import "server-only";

import { anthropicTranslationProvider } from "./anthropicProvider";
import type { TranslationProvider } from "./provider";

// Anthropic is the only translation provider. If credits are exhausted or
// the API key is missing the provider throws TranslationUnavailableError
// and the route returns a 503; we no longer fall back to canned data.
export function getTranslationProvider(): TranslationProvider {
  return anthropicTranslationProvider;
}
