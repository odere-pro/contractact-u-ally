import "server-only";

import { rateLimit } from "@/lib/rateLimit";
import { analyzeFormFieldsSchema } from "@/lib/catalog/schemas";
import { runRiskPipeline } from "@/lib/pipeline/runRiskPipeline";
import {
  MAX_UPLOAD_BYTES,
  validateUpload,
  type UploadValidationFailure,
} from "@/lib/uploadValidation";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function statusForFailure(reason: UploadValidationFailure): number {
  if (reason === "too_large") return 413;
  if (reason === "mime_not_allowed") return 415;
  return 400;
}

function messageForFailure(reason: UploadValidationFailure): string {
  switch (reason) {
    case "empty":
      return "Empty file";
    case "too_large":
      return "File too large";
    case "mime_not_allowed":
      return "Unsupported file type";
    case "magic_mismatch":
      return "File contents do not match declared type";
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!rateLimit(req, "analyze", { capacity: 5, refillPerSec: 5 / 60 })) {
    return jsonError(429, "Too many requests. Slow down.");
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return jsonError(503, "OCR service not configured");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Expected multipart/form-data");
  }

  const candidate = form.get("file");
  if (!(candidate instanceof File)) {
    return jsonError(400, "Missing 'file' field");
  }

  if (candidate.type !== "application/pdf") {
    return jsonError(415, "Only PDF uploads are supported");
  }

  if (candidate.size > MAX_UPLOAD_BYTES) {
    return jsonError(413, "File too large");
  }

  const bytes = new Uint8Array(await candidate.arrayBuffer());

  const validation = validateUpload({
    declaredMime: candidate.type,
    sizeBytes: candidate.size,
    head: bytes.slice(0, 16),
  });
  if (!validation.ok) {
    return jsonError(statusForFailure(validation.reason), messageForFailure(validation.reason));
  }

  const fields = analyzeFormFieldsSchema.safeParse({
    jurisdiction: form.get("jurisdiction") ?? undefined,
    typeId: form.get("typeId") ?? undefined,
  });
  if (!fields.success) {
    const first = fields.error.issues[0];
    return jsonError(400, first?.message ?? "Invalid request");
  }

  const stream = runRiskPipeline({
    pdfBytes: bytes,
    mistralApiKey: apiKey,
    jurisdiction: fields.data.jurisdiction,
    typeId: fields.data.typeId,
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
