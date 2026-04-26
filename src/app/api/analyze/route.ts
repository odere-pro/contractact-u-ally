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

// Multipart is a CORS "simple" request — no preflight. We have no
// state-changing effect today, but burning a user's rate-limit quota
// from another origin still has cost (Mistral + Anthropic). Trust
// `Sec-Fetch-Site` first (browsers set this on every fetch and JS
// cannot override it cross-origin), fall back to `Origin` host match.
// Requests with neither header (server-to-server, curl) are allowed.
//
// Exported only for unit tests — `Origin` and `Sec-Fetch-Site` are
// forbidden request headers in the WHATWG Fetch spec, so they cannot
// be set on a synthetic `Request` in Node and must be tested via this
// pure helper instead.
export function isAllowedOrigin(headers: Headers, requestUrl: string): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) {
    return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
  }
  const origin = headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  return originHost === new URL(requestUrl).host;
}

// Multipart form fields decode as `string | File`. A File would still
// be truthy after `?? undefined` and would reach Zod with a confusing
// "[object File]" → regex error. Narrow to string up front.
function stringField(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

export async function POST(req: Request): Promise<Response> {
  if (!isAllowedOrigin(req.headers, req.url)) {
    return jsonError(403, "Cross-origin requests are not allowed");
  }

  // Tighter than the old /api/ocr bucket — this endpoint now drives both
  // OCR and Claude streaming, so each request is materially more
  // expensive and 2/min/IP is a saner default.
  if (!rateLimit(req, "analyze", { capacity: 2, refillPerSec: 2 / 60 })) {
    return jsonError(429, "Too many requests. Slow down.");
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return jsonError(503, "OCR service not configured");
  }

  // Cheap reject before we let Node's multipart parser buffer the body.
  // Browsers always set Content-Length on multipart bodies; the value
  // can be spoofed but the per-file size check after parse is the
  // load-bearing guard. This is just abuse-traffic defence.
  const declaredLengthHeader = req.headers.get("content-length");
  if (declaredLengthHeader !== null) {
    const declaredLength = Number(declaredLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES + 4096) {
      return jsonError(413, "File too large");
    }
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
    jurisdiction: stringField(form, "jurisdiction"),
    typeId: stringField(form, "typeId"),
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
