import "server-only";

import { z } from "zod";

import { getAnthropic } from "@/lib/anthropicClient";
import { isAnthropicAuthError, isAnthropicCreditError } from "@/lib/anthropicErrors";

import {
  TranslationUnavailableError,
  type TranslateTargetLang,
  type TranslationProvider,
} from "./provider";
import type { TranslateItem, UiLanguage } from "./types";

const NAME = "anthropic";

const TRANSLATE_MODEL = "claude-haiku-4-5-20251001";
const TRANSLATE_MAX_TOKENS = 8192;

const LANGUAGE_NAME: Record<UiLanguage, string> = {
  en: "English",
  nl: "Dutch (Nederlands)",
  sv: "Swedish (Svenska)",
};

const itemSchema = z.object({
  id: z.string().min(1).max(128),
  text: z.string(),
});

const responseSchema = z.object({
  translations: z.array(itemSchema),
});

function buildSystemPrompt(targetLang: TranslateTargetLang): string {
  const name = LANGUAGE_NAME[targetLang];
  return [
    `You translate short legal-contract text fragments into ${name}.`,
    "Input is JSON: { items: [{ id, text }, ...] }.",
    `Translate every "text" field into ${name}. Preserve meaning precisely; do not soften legal terms.`,
    "Keep paragraph breaks, line breaks, and inline numbers / currency / dates untouched.",
    "If a fragment is empty, return it empty.",
    'Respond with a single JSON object: { "translations": [{ "id", "text" }, ...] } and nothing else.',
    "Preserve the order and ids exactly.",
  ].join("\n");
}

// Calls Haiku, parses + realigns the response. Throws
// TranslationUnavailableError on credit exhaustion or unparseable model
// output so the route can map it to a 503 — never returns source text
// silently under an NL/SV pill.
export const anthropicTranslationProvider: TranslationProvider = {
  name: NAME,
  async translate(
    targetLang: TranslateTargetLang,
    items: readonly TranslateItem[],
  ): Promise<readonly TranslateItem[]> {
    const systemPrompt = buildSystemPrompt(targetLang);
    const userMessage = JSON.stringify({ items });

    let response;
    try {
      response = await getAnthropic().messages.create({
        model: TRANSLATE_MODEL,
        max_tokens: TRANSLATE_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
    } catch (err) {
      if (isAnthropicCreditError(err)) {
        throw new TranslationUnavailableError("Anthropic credit exhausted", NAME);
      }
      if (isAnthropicAuthError(err)) {
        throw new TranslationUnavailableError("Anthropic API key missing or invalid", NAME);
      }
      throw err;
    }

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new TranslationUnavailableError("Anthropic returned no JSON object", NAME);
    }
    const slice = text.slice(start, end + 1);

    let candidate: unknown;
    try {
      candidate = JSON.parse(slice);
    } catch {
      throw new TranslationUnavailableError("Anthropic returned invalid JSON", NAME);
    }

    const parsed = responseSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new TranslationUnavailableError("Anthropic returned malformed response", NAME);
    }

    // Realign on the ids the caller sent. Claude occasionally drops or
    // duplicates an entry; this keeps every requested key accounted for.
    const map = new Map(parsed.data.translations.map((t) => [t.id, t.text]));
    return items.map((item) => ({ id: item.id, text: map.get(item.id) ?? item.text }));
  },
};
