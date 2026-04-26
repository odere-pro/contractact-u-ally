import "server-only";

import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Reson8 prerecorded STT — https://docs.reson8.dev/api/speech-to-text/prerecorded/
const RESON8_URL = "https://api.reson8.dev/v1/speech-to-text/prerecorded";

const STT_TIMEOUT_MS = 30_000;

// Reson8 custom model IDs are UUIDs — validate before injecting into URL.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Audio-in, transcript-out. Reasoning lives in /api/answer so the
// typed-text path can skip STT entirely and both paths converge on the
// same streaming Claude pipeline.
export async function POST(req: NextRequest): Promise<Response> {
  if (!rateLimit(req, "transcribe", { capacity: 20, refillPerSec: 20 / 60 })) {
    return jsonError(429, "Too many requests.");
  }

  const apiKey = process.env.RESON8_API_KEY;
  if (!apiKey) return jsonError(503, "Transcription service not configured");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Expected multipart/form-data");
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) return jsonError(400, "Missing 'audio' field");

  // Reject 0-byte files before they reach Reson8 and return a cryptic 400.
  if (audio.size === 0) return jsonError(400, "Audio file is empty");
  if (audio.size > 10 * 1024 * 1024) return jsonError(413, "Audio too large (max 10 MB)");

  // Validate customModelId as a UUID before appending to URL — an
  // unvalidated string from form data could inject extra query params.
  const rawModelId = form.get("customModelId");
  const customModelId =
    typeof rawModelId === "string" && UUID_RE.test(rawModelId.trim()) ? rawModelId.trim() : null;

  const audioBuffer = await audio.arrayBuffer();
  const t0 = Date.now();

  const sttUrl = new URL(`${RESON8_URL}?include_words=true`);
  if (customModelId) {
    sttUrl.searchParams.set("custom_model_id", customModelId);
  }

  let reson8Res: Response;
  try {
    // AbortSignal.timeout prevents the route from hanging if Reson8 is slow.
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

  return new Response(JSON.stringify({ transcript, sttMs }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
