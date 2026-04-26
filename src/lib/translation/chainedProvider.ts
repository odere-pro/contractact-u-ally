import "server-only";

import {
  TranslationUnavailableError,
  type TranslateTargetLang,
  type TranslationProvider,
} from "./provider";
import type { TranslateItem } from "./types";

// Tries each provider in order; first successful result wins. If every
// provider throws TranslationUnavailableError, rethrows the last one so
// the route can map it to a 503. Other errors propagate immediately —
// they're bugs, not "unavailable".
export function chain(...providers: readonly TranslationProvider[]): TranslationProvider {
  if (providers.length === 0) {
    throw new Error("chain() requires at least one provider");
  }

  return {
    name: `chain(${providers.map((p) => p.name).join("→")})`,
    async translate(
      targetLang: TranslateTargetLang,
      items: readonly TranslateItem[],
    ): Promise<readonly TranslateItem[]> {
      let lastUnavailable: TranslationUnavailableError | null = null;
      for (const provider of providers) {
        try {
          return await provider.translate(targetLang, items);
        } catch (err) {
          if (err instanceof TranslationUnavailableError) {
            console.warn(`translation chain: ${provider.name} unavailable: ${err.message}`);
            lastUnavailable = err;
            continue;
          }
          throw err;
        }
      }
      // Unreachable unless every provider threw TranslationUnavailableError.
      throw (
        lastUnavailable ??
        new TranslationUnavailableError("No translation provider succeeded", "chain")
      );
    },
  };
}
