import "server-only";

import { isMockOnlyMode } from "@/lib/anthropicFallback";

import { anthropicTranslationProvider } from "./anthropicProvider";
import { chain } from "./chainedProvider";
import { mockTranslationProvider } from "./mockProvider";
import type { TranslationProvider } from "./provider";

// Composes the provider chain for the current runtime environment.
//
// - No ANTHROPIC_API_KEY → mock-only. Importing anthropicProvider would
//   eagerly construct an SDK client and throw on missing key, so we
//   short-circuit before touching it.
// - Otherwise → Anthropic first, mock as fallback. The mock link is the
//   safety net for two cases the route can't tell apart from env state:
//     (a) Anthropic credits depleted at translate-time, and
//     (b) the analyze stage already fell back to mock NDJSON, so the
//         on-screen content is the synthetic mock contract whose ids
//         live in the mock dictionary.
export function getTranslationProvider(): TranslationProvider {
  if (isMockOnlyMode()) {
    return mockTranslationProvider;
  }
  return chain(anthropicTranslationProvider, mockTranslationProvider);
}
