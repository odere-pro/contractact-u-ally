import "server-only";

import { getAnthropic } from "@/lib/anthropicClient";
import { isAnthropicCreditError } from "@/lib/anthropicErrors";
import { classifyContract } from "@/lib/catalog/classifier";
import { loadRulesForType } from "@/lib/catalog/ruleLoader";
import { clauseEventSchema, MAX_CONTRACT_BYTES, summaryEventSchema } from "@/lib/catalog/schemas";
import type { ClassifyResult, Jurisdiction, LoadedRuleSet } from "@/lib/catalog/types";
import { runMistralOcr } from "@/lib/mistralOcr";

import { buildAnalysisSystemPrompt, loadRiskExamples } from "./prompts";
import {
  encodeClause,
  encodeError,
  encodeOcrText,
  encodeStage,
  encodeSummary,
} from "./streamEvents";

const ANALYZE_MODEL = "claude-sonnet-4-6";
const ANALYZE_MAX_TOKENS = 8192;

export type OcrResult =
  | {
      readonly ok: true;
      readonly text: string;
      readonly pages: number;
      readonly durationMs: number;
    }
  | { readonly ok: false; readonly reason: string };

export type OcrFactory = (pdfBytes: Uint8Array) => Promise<OcrResult>;

export interface RunRiskPipelineOptions {
  readonly pdfBytes: Uint8Array;
  readonly mistralApiKey: string;
  readonly jurisdiction?: Jurisdiction;
  readonly typeId?: string;
  readonly textStreamFactory?: TextStreamFactory;
  readonly ocrFactory?: OcrFactory;
}

export interface TextStreamSourceArgs {
  readonly systemPrompt: string;
  readonly userMessage: string;
}

export type TextStreamFactory = (args: TextStreamSourceArgs) => AsyncIterable<string>;

async function* defaultClaudeStream(args: TextStreamSourceArgs): AsyncIterable<string> {
  const anthropicStream = getAnthropic().messages.stream({
    model: ANALYZE_MODEL,
    max_tokens: ANALYZE_MAX_TOKENS,
    system: args.systemPrompt,
    messages: [{ role: "user", content: args.userMessage }],
  });

  for await (const event of anthropicStream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

function validateAndEncodeLine(line: string): Uint8Array | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const clause = clauseEventSchema.safeParse(obj);
  if (clause.success) return encodeClause(clause.data);

  const summary = summaryEventSchema.safeParse(obj);
  if (summary.success) {
    const ok =
      summary.data.illegalCount === 0 &&
      summary.data.exploitativeCount === 0 &&
      summary.data.permitConflictCount === 0;
    return encodeSummary({ ...summary.data, ok });
  }

  return null;
}

const utf8ByteLength = (s: string): number => new TextEncoder().encode(s).byteLength;

class OcrPipelineError extends Error {
  override readonly name = "OcrPipelineError";
}

class ContractTextRangeError extends Error {
  override readonly name = "ContractTextRangeError";
}

class AnthropicCreditPipelineError extends Error {
  override readonly name = "AnthropicCreditPipelineError";
}

/**
 * Orchestrate ocr → classify → load rules → Claude stream → emit NDJSON.
 *
 * The returned ReadableStream emits, in order:
 *   1. {"type":"stage","stage":"ocr","progress":0|1}
 *   2. {"type":"stage","stage":"classify","progress":0|1}
 *   3. {"type":"stage","stage":"load_rules","progress":0|1}
 *   4. {"type":"stage","stage":"analyze","progress":0}
 *   5. many {"type":"clause", …}
 *   6. one {"type":"summary", …}
 *
 * On failure, emits {"type":"error","message":"…"} and closes. The HTTP
 * status is fixed at 200 because headers have already flushed.
 */
export function runRiskPipeline(opts: RunRiskPipelineOptions): ReadableStream<Uint8Array> {
  const textFactory = opts.textStreamFactory ?? defaultClaudeStream;
  const ocrFactory = opts.ocrFactory ?? defaultMistralOcr(opts.mistralApiKey);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let alive = true;
      const safeEnqueue = (chunk: Uint8Array): void => {
        if (!alive) return;
        try {
          controller.enqueue(chunk);
        } catch {
          alive = false;
        }
      };

      try {
        // Stage 1: OCR. Server-internal — the browser only sees stage
        // events; the PDF never round-trips back as a separate response.
        safeEnqueue(encodeStage("ocr", 0));
        const ocr = await ocrFactory(opts.pdfBytes);
        if (!ocr.ok) throw new OcrPipelineError(ocr.reason);

        // Guard the prompt builder against pathological OCR output.
        // 200 chars is the floor for "looks like a real contract"; 500
        // KB UTF-8 protects the model context window.
        if (ocr.text.length < 200) {
          throw new ContractTextRangeError("OCR text too short — likely an OCR failure");
        }
        if (utf8ByteLength(ocr.text) > MAX_CONTRACT_BYTES) {
          throw new ContractTextRangeError("OCR text exceeds 500KB");
        }
        safeEnqueue(encodeStage("ocr", 1));

        const ocrText = ocr.text;
        // Hand the extracted text to the client up front so the contract
        // preview can render alongside the streaming clause results.
        safeEnqueue(encodeOcrText(ocrText, ocr.pages));

        // Stage 2: classify
        safeEnqueue(encodeStage("classify", 0));
        const classifyResult: ClassifyResult = opts.typeId
          ? { typeId: opts.typeId, confidence: 1, jurisdiction: opts.jurisdiction ?? "nl" }
          : await classifyContract(ocrText, opts.jurisdiction);
        safeEnqueue(encodeStage("classify", 1));

        // Stage 3: load rules
        safeEnqueue(encodeStage("load_rules", 0));
        const [ruleSet, riskExamples]: [LoadedRuleSet, string] = await Promise.all([
          loadRulesForType(classifyResult.typeId, classifyResult.jurisdiction),
          loadRiskExamples(),
        ]);
        safeEnqueue(encodeStage("load_rules", 1));

        // Stage 4: analyze (streaming)
        safeEnqueue(encodeStage("analyze", 0));
        const systemPrompt = buildAnalysisSystemPrompt(ruleSet, riskExamples);

        let buffer = "";
        try {
          for await (const delta of textFactory({
            systemPrompt,
            userMessage: `Analyze this contract:\n\n${ocrText}`,
          })) {
            if (!alive) break;
            buffer += delta;
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const out = validateAndEncodeLine(line);
              if (out) safeEnqueue(out);
            }
          }
        } catch (err) {
          throw err;
        }
        if (alive && buffer.trim()) {
          const out = validateAndEncodeLine(buffer);
          if (out) safeEnqueue(out);
        }

        if (alive) controller.close();
      } catch (err) {
        const message = sanitizeErrorMessage(err);
        safeEnqueue(encodeError(message));
        if (alive) {
          try {
            controller.close();
          } catch {
            // Already closed by safeEnqueue catch path — nothing to do.
          }
        }
      }
    },
  });
}

function defaultMistralOcr(apiKey: string): OcrFactory {
  return async (pdfBytes) => {
    const result = await runMistralOcr(pdfBytes, apiKey);
    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, text: result.text, pages: result.pages, durationMs: result.durationMs };
  };
}

// Domain error messages are programmer-controlled and therefore safe
// to surface, but we still cap their length and run the same
// path-fragment filter as `sanitizeErrorMessage` so a future change
// that introduces user-controlled content into `reason` cannot silently
// bypass sanitization.
function safeDomainMessage(message: string, fallback: string): string {
  if (message.length > 120) return fallback;
  if (message.includes("ENOENT") || message.includes("/")) return fallback;
  return message;
}

/**
 * Produce a client-safe error message. Filesystem paths from `ENOENT`,
 * SDK internals, and stack fragments must not reach the browser; map
 * known categories to fixed strings, log the raw error server-side.
 */
function sanitizeErrorMessage(err: unknown): string {
  if (err instanceof AnthropicCreditPipelineError) {
    console.warn("runRiskPipeline: Anthropic credit balance too low");
    return err.message;
  }
  if (err instanceof OcrPipelineError) return safeDomainMessage(err.message, "OCR pipeline error");
  if (err instanceof ContractTextRangeError) {
    return safeDomainMessage(err.message, "Contract text out of accepted range");
  }
  // Surface Anthropic credit/auth failures as a clear, actionable message
  // instead of the cryptic raw SDK string. Without this users see the SDK
  // mentioning "credit balance" with no idea who's responsible for fixing it.
  if (isAnthropicCreditError(err)) {
    console.error("runRiskPipeline: Anthropic credit balance too low");
    return "Anthropic credits exhausted. Top up the API plan and retry.";
  }
  if (err instanceof Error) {
    const raw = err.message;
    console.error("runRiskPipeline failure:", err);
    if (raw.includes("ENOENT") || raw.includes("/")) return "Internal pipeline error";
    if (raw.length > 200) return "Internal pipeline error";
    return raw;
  }
  console.error("runRiskPipeline failure (non-Error):", err);
  return "Analysis failed";
}
