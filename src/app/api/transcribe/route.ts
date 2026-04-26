import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "fs/promises";
import type { NextRequest } from "next/server";
import path from "path";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Reson8 prerecorded STT — https://docs.reson8.dev/api/speech-to-text/prerecorded/
const RESON8_URL = "https://api.reson8.dev/v1/speech-to-text/prerecorded";

const STT_TIMEOUT_MS = 30_000;

// Reson8 custom model IDs are UUIDs — validate before injecting into URL.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Domain vocabulary file — loaded once per process.
let domainVocabCache: DomainVocab | null = null;

interface DomainVocab {
  abbreviations: { nl: AbbrevEntry[]; se: AbbrevEntry[] };
  key_concepts: { nl: ConceptEntry[]; se: ConceptEntry[] };
  spoken_variants: SpokenVariant[];
}
interface AbbrevEntry {
  abbr: string;
  full: string;
  en: string;
}
interface ConceptEntry {
  term: string;
  en: string;
  note: string;
}
interface SpokenVariant {
  spoken: string;
  canonical: string;
}

async function loadDomainVocab(): Promise<DomainVocab | null> {
  if (domainVocabCache) return domainVocabCache;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "domain-vocab", "labor-law-terms.json"),
      "utf-8",
    );
    domainVocabCache = JSON.parse(raw) as DomainVocab;
    return domainVocabCache;
  } catch (err) {
    console.error("Failed to load domain vocab:", err);
    return null;
  }
}

function buildDomainContext(vocab: DomainVocab | null, jurisdiction: string): string {
  if (!vocab) return "";
  const jur = jurisdiction === "se" ? "se" : "nl";

  // Defensive: guard against missing keys in case the JSON file is incomplete.
  const abbrevs = (vocab.abbreviations?.[jur] ?? [])
    .map((a) => `${a.abbr} = ${a.full} (${a.en})`)
    .join("\n");
  const concepts = (vocab.key_concepts?.[jur] ?? [])
    .map((c) => `${c.term} (${c.en}): ${c.note}`)
    .join("\n");
  const spoken = (vocab.spoken_variants ?? [])
    .map((s) => `"${s.spoken}" → ${s.canonical}`)
    .join(", ");

  return `## Labor law abbreviations (${jur.toUpperCase()})
${abbrevs}

## Key concepts
${concepts}

## Spoken variants to watch for
${spoken}`;
}

function buildReasoningPrompt(
  transcript: string,
  jurisdiction: string,
  domainContext: string,
  clauses: unknown[],
): string {
  const clauseSummary =
    Array.isArray(clauses) && clauses.length > 0
      ? clauses
          .map((c: unknown) => {
            const cl = c as Record<string, unknown>;
            const citation = cl.citation as Record<string, string> | null;
            return `[${String(cl.status ?? "").toUpperCase()}] ${cl.title ?? ""}: ${cl.explanation ?? ""}${citation ? ` (${citation.article})` : ""}${cl.action ? ` → Action: ${cl.action}` : ""}`;
          })
          .join("\n")
      : "No contract analysis provided.";

  const hasContract = Array.isArray(clauses) && clauses.length > 0;

  // Escape double-quotes in transcript to prevent prompt injection.
  const safeTranscript = transcript.replace(/"/g, "'");

  return `You are a labor law advisor helping a worker understand THEIR specific employment contract. You have access to the full clause-by-clause analysis of that contract.

SCOPE RESTRICTION: You ONLY answer questions about this specific analyzed contract and its clauses. If the worker asks about anything unrelated to this contract (e.g. general questions, other topics, other contracts), politely say: "I can only help with questions about your analyzed contract. Please ask me about a specific clause or your rights under this contract."

${domainContext}

## Contract analysis (${jurisdiction === "se" ? "Swedish" : "Dutch"} law)
${hasContract ? clauseSummary : "No contract has been analyzed yet. Ask the worker to upload and analyze their contract first."}

## Worker's voice question
"${safeTranscript}"

## Answer instructions
- Answer in the same language as the question (detect from transcript — Dutch if Dutch words present)
- ONLY discuss clauses and issues from the analysis above — do not invent new clauses
- Reference the exact clause title and its status (ILLEGAL/EXPLOITATIVE/COMPLIANT) from the list
- Cite the relevant legal article (e.g. BW 7:652) when explaining violations
- Max 4 sentences — response will be read aloud via text-to-speech
- End with one concrete action the worker can take right now`;
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!rateLimit(req, "transcribe", { capacity: 20, refillPerSec: 20 / 60 })) {
    return jsonError(429, "Too many requests.");
  }

  const apiKey = process.env.RESON8_API_KEY;
  if (!apiKey) return jsonError(503, "Transcription service not configured");

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(503, "Analysis service not configured");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Expected multipart/form-data");
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) return jsonError(400, "Missing 'audio' field");

  // Bug fix: reject 0-byte files before they reach Reson8 and return a cryptic 400.
  if (audio.size === 0) return jsonError(400, "Audio file is empty");
  if (audio.size > 10 * 1024 * 1024) return jsonError(413, "Audio too large (max 10 MB)");

  // Optional context: jurisdiction + contract clauses from prior analysis
  let jurisdiction = "nl";
  let clauses: unknown[] = [];
  const rawCtx = form.get("context");
  if (typeof rawCtx === "string") {
    try {
      const ctx = JSON.parse(rawCtx) as Record<string, unknown>;
      if (ctx.jurisdiction === "se" || ctx.jurisdiction === "nl") {
        jurisdiction = ctx.jurisdiction;
      }
      if (Array.isArray(ctx.clauses)) clauses = ctx.clauses;
    } catch {
      // Use defaults — not fatal.
    }
  }

  // Bug fix: validate customModelId as a UUID before appending to URL.
  // An unvalidated string from form data could inject additional query params.
  const rawModelId = form.get("customModelId");
  const customModelId =
    typeof rawModelId === "string" && UUID_RE.test(rawModelId.trim()) ? rawModelId.trim() : null;

  // --- Step 1: Reson8 STT ---
  const audioBuffer = await audio.arrayBuffer();
  const t0 = Date.now();

  const sttUrl = new URL(`${RESON8_URL}?include_words=true`);
  if (customModelId) {
    sttUrl.searchParams.set("custom_model_id", customModelId);
  }

  let reson8Res: Response;
  try {
    // Bug fix: AbortSignal.timeout prevents the route from hanging if Reson8 is slow.
    reson8Res = await fetch(sttUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/octet-stream",
      },
      body: audioBuffer,
      signal: AbortSignal.timeout(STT_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return jsonError(
      502,
      isTimeout ? "Transcription service timed out" : "Transcription service unreachable",
    );
  }

  if (!reson8Res.ok) {
    const errText = await reson8Res.text().catch(() => "");
    console.error("Reson8 STT error:", reson8Res.status, errText);
    const msg =
      reson8Res.status === 401
        ? "Invalid transcription API key"
        : `Transcription service error ${reson8Res.status}`;
    return jsonError(502, msg);
  }

  let reson8Json: unknown;
  try {
    reson8Json = await reson8Res.json();
  } catch {
    return jsonError(502, "Transcription service returned invalid JSON");
  }

  const r = reson8Json as Record<string, unknown>;
  const transcript: string =
    typeof r.text === "string" ? r.text : typeof r.transcript === "string" ? r.transcript : "";
  const sttMs = Date.now() - t0;

  if (!transcript.trim()) {
    return jsonError(422, "No speech detected in audio. Please speak clearly and try again.");
  }

  // --- Step 2: Load domain vocab + build reasoning prompt ---
  const vocab = await loadDomainVocab();
  const domainContext = buildDomainContext(vocab, jurisdiction);
  const reasoningPrompt = buildReasoningPrompt(transcript, jurisdiction, domainContext, clauses);

  // --- Step 3: Claude reasoning ---
  const client = new Anthropic();
  const t1 = Date.now();

  let reasoningText = "";
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: reasoningPrompt }],
    });
    reasoningText = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
  } catch (err) {
    console.error("Claude reasoning error:", err);
    reasoningText = "Unable to generate a response at this time. Please try again.";
  }

  const reasoningMs = Date.now() - t1;

  return new Response(
    JSON.stringify({
      transcript,
      reasoning: reasoningText,
      sttMs,
      reasoningMs,
      totalMs: sttMs + reasoningMs,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
