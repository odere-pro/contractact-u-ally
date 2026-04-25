import "server-only";

import { rateLimit } from "@/lib/rateLimit";
import { analyzeRequestSchema } from "@/lib/catalog/schemas";
import { runRiskPipeline } from "@/lib/pipeline/runRiskPipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  if (!rateLimit(req, "analyze", { capacity: 5, refillPerSec: 5 / 60 })) {
    return jsonError(429, "Too many requests. Slow down.");
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, "Expected JSON body");
  }

  const parsed = analyzeRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError(400, first?.message ?? "Invalid request");
  }

  const stream = runRiskPipeline({
    ocrText: parsed.data.ocrText,
    jurisdiction: parsed.data.jurisdiction,
    typeId: parsed.data.typeId,
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
