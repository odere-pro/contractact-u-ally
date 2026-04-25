import "server-only";

import { getAnthropic } from "@/lib/anthropicClient";
import { classifyContract } from "@/lib/catalog/classifier";
import { loadRulesForType } from "@/lib/catalog/ruleLoader";
import { clauseEventSchema, summaryEventSchema } from "@/lib/catalog/schemas";
import type { ClassifyResult, Jurisdiction, LoadedRuleSet } from "@/lib/catalog/types";

import { buildAnalysisSystemPrompt, loadRiskExamples } from "./prompts";
import { encodeClause, encodeError, encodeStage, encodeSummary } from "./streamEvents";

const ANALYZE_MODEL = "claude-sonnet-4-6";
const ANALYZE_MAX_TOKENS = 8192;

export interface RunRiskPipelineOptions {
  readonly ocrText: string;
  readonly jurisdiction?: Jurisdiction;
  readonly typeId?: string;
  /**
   * Source of incremental text deltas to parse as NDJSON. In production the
   * default factory wires this to Claude streaming. Tests inject a fake.
   */
  readonly textStreamFactory?: TextStreamFactory;
}

export interface TextStreamSourceArgs {
  readonly systemPrompt: string;
  readonly userMessage: string;
}

export type TextStreamFactory = (args: TextStreamSourceArgs) => AsyncIterable<string>;

/**
 * Default factory: drive Claude via Anthropic SDK streaming and yield text
 * deltas as they arrive.
 */
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

/**
 * Try to parse one trimmed JSON line as either a ClauseEvent or SummaryEvent.
 * Returns the encoded NDJSON line, or null if the line is malformed.
 */
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
  if (summary.success) return encodeSummary(summary.data);

  return null;
}

/**
 * Orchestrate classify → load rules → Claude stream → emit NDJSON.
 *
 * The returned ReadableStream emits, in order:
 *   1. {"type":"stage","stage":"classify","progress":0|1}
 *   2. {"type":"stage","stage":"load_rules","progress":0|1}
 *   3. {"type":"stage","stage":"analyze","progress":0}
 *   4. many {"type":"clause", …}
 *   5. one {"type":"summary", …}
 *
 * On failure, emits {"type":"error","message":"…"} and closes. The HTTP
 * status is fixed at 200 because headers have already flushed.
 */
export function runRiskPipeline(opts: RunRiskPipelineOptions): ReadableStream<Uint8Array> {
  const factory = opts.textStreamFactory ?? defaultClaudeStream;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // The consumer can disconnect at any moment (browser tab closed,
      // useAnalysisStream aborted, etc.). After that, controller.enqueue
      // throws TypeError; we must not propagate that as a pipeline error.
      // Track local liveness so a single guarded enqueue covers all paths.
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
        // Stage 1: classify
        safeEnqueue(encodeStage("classify", 0));
        const classifyResult: ClassifyResult = opts.typeId
          ? { typeId: opts.typeId, confidence: 1, jurisdiction: opts.jurisdiction ?? "nl" }
          : await classifyContract(opts.ocrText, opts.jurisdiction);
        safeEnqueue(encodeStage("classify", 1));

        // Stage 2: load rules
        safeEnqueue(encodeStage("load_rules", 0));
        const [ruleSet, riskExamples]: [LoadedRuleSet, string] = await Promise.all([
          loadRulesForType(classifyResult.typeId, classifyResult.jurisdiction),
          loadRiskExamples(),
        ]);
        safeEnqueue(encodeStage("load_rules", 1));

        // Stage 3: analyze (streaming)
        safeEnqueue(encodeStage("analyze", 0));
        const systemPrompt = buildAnalysisSystemPrompt(ruleSet, riskExamples);

        let buffer = "";
        for await (const delta of factory({
          systemPrompt,
          userMessage: `Analyze this contract:\n\n${opts.ocrText}`,
        })) {
          if (!alive) break;
          buffer += delta;
          // NDJSON: split on newlines, emit complete lines, keep the tail.
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const out = validateAndEncodeLine(line);
            if (out) safeEnqueue(out);
          }
        }
        // Flush trailing fragment, if any.
        if (alive && buffer.trim()) {
          const out = validateAndEncodeLine(buffer);
          if (out) safeEnqueue(out);
        }

        if (alive) controller.close();
      } catch (err) {
        // We deliberately keep error reporting in-band as a {type:"error"}
        // event because the HTTP status is already 200 once headers flush —
        // controller.error() would surface to the client as a network
        // failure with no recoverable message. The UI hook reads the event
        // and transitions to phase=error. Sanitize the message so internal
        // paths / SDK internals don't leak.
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

/**
 * Produce a client-safe error message. Filesystem paths from `ENOENT`,
 * SDK internals, and stack fragments must not reach the browser; map
 * known categories to fixed strings, log the raw error server-side.
 */
function sanitizeErrorMessage(err: unknown): string {
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
