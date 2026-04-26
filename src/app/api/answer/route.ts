import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAnthropic } from "@/lib/anthropicClient";
import {
  buildDomainContext,
  buildReasoningPrompt,
  loadDomainVocab,
  normalizeJurisdiction,
} from "@/lib/qa/prompt";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Trim long questions before they ever reach the model. Voice transcripts
// rarely exceed a few hundred chars; typed input is capped here so a
// pasted novel can't burn the model budget.
const MAX_QUESTION_CHARS = 1000;

const requestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
  jurisdiction: z.union([z.literal("nl"), z.literal("se")]).optional(),
  // Pass clauses through opaquely — the prompt builder narrows what it
  // reads. A schema here would couple this route to the catalog types
  // and produce a worse error than "unknown field" if shapes drift.
  clauses: z.array(z.unknown()).max(200).optional(),
});

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// JSON-in, SSE-out. Streams Claude reasoning deltas as `delta` events
// followed by a `done` event. Both the voice and text Q&A paths land
// here; voice posts the STT transcript, text posts the user's typing.
export async function POST(req: NextRequest): Promise<Response> {
  if (!rateLimit(req, "answer", { capacity: 20, refillPerSec: 20 / 60 })) {
    return jsonError(429, "Too many requests.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(503, "Analysis service not configured");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Expected JSON body");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid request");
  }

  const { question, clauses = [] } = parsed.data;
  const jurisdiction = normalizeJurisdiction(parsed.data.jurisdiction);

  const vocab = await loadDomainVocab();
  const domainContext = buildDomainContext(vocab, jurisdiction);
  const prompt = buildReasoningPrompt(question, jurisdiction, domainContext, clauses);

  const client = getAnthropic();
  const encoder = new TextEncoder();

  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        console.log("[anthropic] answer.stream", {
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          jurisdiction,
          questionLen: question.length,
          clauseCount: clauses.length,
          promptLen: prompt.length,
        });
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            event.delta.text
          ) {
            controller.enqueue(encoder.encode(sseEvent("delta", { text: event.delta.text })));
          }
        }

        controller.enqueue(encoder.encode(sseEvent("done", {})));
      } catch (err) {
        console.error("Claude streaming error:", err);
        controller.enqueue(
          encoder.encode(sseEvent("error", { message: "Unable to generate a response." })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sse, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
