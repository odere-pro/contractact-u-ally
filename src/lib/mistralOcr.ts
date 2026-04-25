import "server-only";

import { z } from "zod";

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const MISTRAL_OCR_MODEL = "mistral-ocr-latest";

/**
 * Discriminated result from a Mistral OCR call. The route handler maps
 * these to HTTP statuses; consumers of this lib never see raw fetch errors.
 */
export type MistralOcrResult =
  | { ok: true; text: string; pages: number; durationMs: number }
  | { ok: false; status: 502 | 422; reason: string };

// Validates the Mistral OCR response shape. If Mistral renames `markdown`
// or returns a different envelope, safeParse fails with a 502 instead of
// silently returning empty text.
const mistralResponseSchema = z.object({
  pages: z
    .array(
      z.object({
        markdown: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * Run Mistral OCR on PDF bytes and return concatenated markdown text.
 * Returns a discriminated result rather than throwing — callers branch
 * on `ok` and surface `reason` to the user with the matching status.
 */
export async function runMistralOcr(
  pdfBytes: Uint8Array,
  apiKey: string,
): Promise<MistralOcrResult> {
  const started = performance.now();

  const base64 = Buffer.from(pdfBytes).toString("base64");
  const dataUrl = `data:application/pdf;base64,${base64}`;

  let response: Response;
  try {
    response = await fetch(MISTRAL_OCR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MISTRAL_OCR_MODEL,
        document: { type: "document_url", document_url: dataUrl },
      }),
    });
  } catch {
    return { ok: false, status: 502, reason: "OCR service unreachable" };
  }

  if (!response.ok) {
    // Drain the body so the connection can be released; never log it (may
    // contain echoed user content per `.claude/rules/security.md`).
    await response.text().catch(() => "");
    const reason =
      response.status === 401 ? "Invalid OCR API key" : `OCR service returned ${response.status}`;
    console.error("Mistral OCR error:", response.status);
    return { ok: false, status: 502, reason };
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { ok: false, status: 502, reason: "OCR service returned invalid JSON" };
  }

  const parsed = mistralResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, reason: "OCR service returned unexpected shape" };
  }
  const pages = parsed.data.pages ?? [];
  const text = pages
    .map((p) => (p.markdown ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  if (!text) {
    return { ok: false, status: 422, reason: "No text extracted from PDF" };
  }

  return {
    ok: true,
    text,
    pages: pages.length,
    durationMs: Math.round(performance.now() - started),
  };
}
