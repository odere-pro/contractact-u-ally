import "server-only";

import { z } from "zod";

import { getAnthropic } from "@/lib/anthropicClient";
import {
  getMockTranslations,
  isAnthropicCreditError,
  isMockOnlyMode,
} from "@/lib/anthropicFallback";
import { rateLimit } from "@/lib/rateLimit";
import { UI_LANGUAGES, type TranslateResponse, type UiLanguage } from "@/lib/translation/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Translation is a small Haiku call — much cheaper than the analyze pipeline,
// but we still cap inbound payloads so a malicious client can't shove a
// 10 MB string through the model.
const MAX_ITEMS = 200;
const MAX_TEXT_BYTES = 200 * 1024;

const TRANSLATE_MODEL = "claude-haiku-4-5-20251001";
const TRANSLATE_MAX_TOKENS = 8192;

const itemSchema = z.object({
  id: z.string().min(1).max(128),
  text: z.string(),
});

const requestSchema = z.object({
  targetLang: z.enum(UI_LANGUAGES),
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
});

const LANGUAGE_NAME: Record<UiLanguage, string> = {
  en: "English",
  nl: "Dutch (Nederlands)",
  sv: "Swedish (Svenska)",
};

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonOk(payload: TranslateResponse): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

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

  // No-op when the user picks the source language — saves a model call
  // and keeps round-trip cost predictable.
  if (targetLang === "en") {
    return jsonOk({ translations: items });
  }

  if (isMockOnlyMode()) {
    // Mock-only mode (no API key): the analyze pipeline already swapped
    // real OCR for the mock contract, so the inbound items are mock ids
    // by construction. Serve canned NL/SV translations instead of the
    // English source — otherwise a language toggle silently re-shows
    // English and the demo looks broken.
    //
    // Gating on the server-side `isMockOnlyMode()` (and NOT on
    // client-supplied ids) closes a spoofability hole: a crafted
    // request with `id: "c:mock-trial-period:title"` would otherwise
    // receive canned text regardless of the contract on screen.
    return jsonOk({ translations: getMockTranslations(targetLang, items) });
  }

  // FIXME(demo-hack): translation should ship as a server-side cache of
  // pre-translated strings (or at minimum a Vercel runtime-cache key per
  // contract hash + lang). Calling Haiku live on every language toggle
  // is here only because the demo accepts arbitrary uploaded contracts
  // and we don't yet have a translation memory layer. Replace before
  // shipping to real users — burns model budget, leaks contract content
  // to the provider, and adds 1–3 s to every language switch.
  const systemPrompt = buildSystemPrompt(targetLang);
  const userMessage = JSON.stringify({ items });

  let translated: readonly { id: string; text: string }[];
  try {
    translated = await runTranslation(systemPrompt, userMessage, items);
  } catch (err) {
    if (isAnthropicCreditError(err)) {
      console.warn("/api/translate: Anthropic credit error — falling back");
      // The credit-error path is hit with a real API key, which means
      // the analyze stage ran for real and the inbound items belong to
      // a real uploaded contract. Returning canned mock text here would
      // be wrong — degrade to source text so the UI keeps working.
      return jsonOk({ translations: items });
    }
    console.error("/api/translate failure:", err);
    return jsonError(502, "Translation service failed");
  }

  return jsonOk({ translations: translated });
}

function buildSystemPrompt(targetLang: UiLanguage): string {
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

const responseSchema = z.object({
  translations: z.array(itemSchema),
});

async function runTranslation(
  systemPrompt: string,
  userMessage: string,
  fallback: readonly { id: string; text: string }[],
): Promise<readonly { id: string; text: string }[]> {
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: TRANSLATE_MODEL,
    max_tokens: TRANSLATE_MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  // Claude is instructed to return JSON only, but we still defend against
  // a stray code-fence or preamble. Find the first `{` and last `}` and
  // attempt to parse the slice — if it fails, fall back to the source so
  // the UI never strands the user on a blank pane.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return fallback;
  }
  const slice = text.slice(start, end + 1);

  let candidate: unknown;
  try {
    candidate = JSON.parse(slice);
  } catch {
    return fallback;
  }

  const parsed = responseSchema.safeParse(candidate);
  if (!parsed.success) return fallback;

  // Realign on the ids the client sent. Claude occasionally drops or
  // duplicates an entry; this keeps every requested key accounted for.
  const map = new Map(parsed.data.translations.map((t) => [t.id, t.text]));
  return fallback.map((item) => ({ id: item.id, text: map.get(item.id) ?? item.text }));
}
