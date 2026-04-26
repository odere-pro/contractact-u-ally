import "server-only";

import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/apiResponse";
import { rateLimit } from "@/lib/rateLimit";
import { TranslationUnavailableError } from "@/lib/translation/provider";
import { getTranslationProvider } from "@/lib/translation/providerFactory";
import {
  UI_LANGUAGES,
  type TranslateItem,
  type TranslateResponse,
  type UiLanguage,
} from "@/lib/translation/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Translation is a small Haiku call — much cheaper than the analyze pipeline,
// but we still cap inbound payloads so a malicious client can't shove a
// 10 MB string through the model.
const MAX_ITEMS = 200;
const MAX_TEXT_BYTES = 200 * 1024;

const itemSchema = z.object({
  id: z.string().min(1).max(128),
  text: z.string(),
});

const requestSchema = z.object({
  targetLang: z.enum(UI_LANGUAGES),
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
});

// Display names used in error copy. Distinct from `UI_LANGUAGE_LABEL`
// (`src/lib/translation/types.ts`), which is the in-product switcher
// label — keep both in sync when adding a new language.
const LANGUAGE_NAME: Record<UiLanguage, string> = {
  en: "English",
  nl: "Dutch (Nederlands)",
  sv: "Swedish (Svenska)",
};

const utf8ByteLength = (s: string): number => new TextEncoder().encode(s).byteLength;

export async function POST(req: Request): Promise<Response> {
  // Same per-IP throttle pattern as /api/analyze, just with a more generous
  // bucket — translations are short and users may switch languages a few
  // times in a session.
  if (!rateLimit(req, "translate", { capacity: 6, refillPerSec: 6 / 60 })) {
    return jsonError(429, "Too many requests. Slow down.");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Expected JSON body");
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError(400, first?.message ?? "Invalid request");
  }
  const { targetLang, items } = parsed.data;

  // Total payload guard. Per-item check would let an attacker submit 200
  // items of MAX_TEXT_BYTES each, blowing past the model context window.
  let totalBytes = 0;
  for (const item of items) {
    totalBytes += utf8ByteLength(item.text);
    if (totalBytes > MAX_TEXT_BYTES) {
      return jsonError(413, "Payload too large");
    }
  }

  // Single helper so every "return the source text" branch returns the
  // same response shape; keeps the success type narrow without polluting
  // each call site with explicit generics.
  const okWithItems = (translations: readonly TranslateItem[]): Response =>
    jsonOk<TranslateResponse>({ translations });

  // No-op when the user picks the source language — saves a model call
  // and keeps round-trip cost predictable.
  if (targetLang === "en") {
    return okWithItems(items);
  }

  // FIXME(demo-hack): translation should ship as a server-side cache of
  // pre-translated strings (or at minimum a Vercel runtime-cache key per
  // contract hash + lang). Calling Haiku live on every language toggle
  // is here only because the demo accepts arbitrary uploaded contracts
  // and we don't yet have a translation memory layer. Replace before
  // shipping to real users — burns model budget, leaks contract content
  // to the provider, and adds 1–3 s to every language switch.
  const provider = getTranslationProvider();
  try {
    const translations = await provider.translate(targetLang, items);
    return okWithItems(translations);
  } catch (err) {
    if (err instanceof TranslationUnavailableError) {
      console.warn(`/api/translate: unavailable (${err.providerName}): ${err.message}`);
      const reason = /credit|quota|billing/i.test(err.message)
        ? "Anthropic credits exhausted — translation is offline until the plan is topped up."
        : `Translation to ${LANGUAGE_NAME[targetLang]} is temporarily unavailable. Showing original text.`;
      return jsonError(503, reason);
    }
    console.error("/api/translate failure:", err);
    // Specific over generic: tell the user which target failed and what
    // they can do next. `targetLang` is Zod-validated to UI_LANGUAGES so
    // there's no injection risk in the response body.
    return jsonError(
      502,
      `Could not translate to ${LANGUAGE_NAME[targetLang]}. Try again or switch back to English.`,
    );
  }
}
