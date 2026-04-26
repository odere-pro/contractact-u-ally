import "server-only";

import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const RESON8_CUSTOM_MODEL_URL = "https://api.reson8.dev/v1/custom-model";

// Reson8 phrases are short boost terms, not sentences — cap at 80 chars each.
const MAX_PHRASE_LEN = 80;
const MAX_PHRASES = 500;
const FETCH_TIMEOUT_MS = 15_000;

// Static domain phrases always included regardless of contract content.
// Sourced from 20 Dutch NL fixture contracts — only terms that actually appear.
const STATIC_PHRASES: string[] = [
  // BW articles
  "BW 7:610",
  "BW 7:625",
  "BW 7:628",
  "BW 7:629",
  "BW 7:634",
  "BW 7:638",
  "BW 7:652",
  "BW 7:653",
  "BW 7:655",
  "BW 7:658",
  "BW 7:668",
  "BW 7:669",
  "BW 7:672",
  "BW 7:673",
  "BW 7:677",
  "BW 7:691",
  // Core Dutch labor law terms
  "vakantiegeld",
  "proeftijd",
  "concurrentiebeding",
  "transitievergoeding",
  "ketenbepaling",
  "uitzendbeding",
  "inlenersbeloning",
  "loondoorbetaling",
  "opzegtermijn",
  "onregelmatigheidstoeslag",
  "geheimhoudingsbeding",
  "studiekostenbeding",
  "relatiebeding",
  "solliciteren",
  "ziekmelding",
  "bedrijfsarts",
  "Wet Verbetering Poortwachter",
  "poortwachter",
  "stageovereenkomst",
  "oproepcontract",
  "uitzendbureau",
  "inlener",
  "uitzendfase A",
  "uitzendfase B",
  "uitzendfase C",
  "wettelijk minimumloon",
  "ontslag op staande voet",
  "ontbinding",
  // Institutions
  "UWV",
  "FNV",
  "CNV",
  "IND",
  "SNA",
  "SNCU",
  "StiPP",
  "Belastingdienst",
  "Nederlandse Arbeidsinspectie",
  // CAOs
  "ABU CAO",
  "NBBU CAO",
  "Horeca CAO",
  "ICT CAO",
  "CAO Glastuinbouw",
  "CAO Contractcatering",
  "CAO voor Uitzendkrachten",
  // Permits
  "GVVA",
  "TWV",
  "Kennismigrant",
  "zoekjaar",
  "ICT permit",
  "EU Blue Card",
  "A1 verklaring",
  "A1 certificaat",
  // Tax / international
  "30 procent regeling",
  "dertig procent regeling",
  "split payroll",
  "WagwEU",
  "NEN 4400-1",
  // Sector-specific
  "BHV",
  "HACCP",
  "sociale hygiëne",
  "ploegbaas",
  "Arbo-wet",
  // Other
  "BSN",
  "burgerservicenummer",
  "BRP",
];

function sanitizePhrase(p: string): string | null {
  const trimmed = p.trim().slice(0, MAX_PHRASE_LEN);
  return trimmed.length >= 2 ? trimmed : null;
}

function sanitizeName(name: string): string {
  // Strip characters that could break JSON or the Reson8 API, cap length.
  return (
    name
      .replace(/[^\w\s\-–—.:]/g, "")
      .trim()
      .slice(0, 100) || "Contract"
  );
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!rateLimit(req, "reson8-model", { capacity: 10, refillPerSec: 10 / 60 })) {
    return jsonError(429, "Too many requests.");
  }

  const apiKey = process.env.RESON8_API_KEY;
  if (!apiKey) return jsonError(503, "Transcription service not configured");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Expected JSON body");
  }

  const raw = body as Record<string, unknown>;

  // Guard: client must send an array; reject obviously oversized payloads before processing.
  const rawPhrases = raw["contractPhrases"];
  if (rawPhrases !== undefined && !Array.isArray(rawPhrases)) {
    return jsonError(400, "contractPhrases must be an array");
  }
  const contractPhrases: unknown[] = Array.isArray(rawPhrases) ? rawPhrases : [];
  if (contractPhrases.length > 1000) {
    return jsonError(400, "contractPhrases exceeds maximum allowed length");
  }

  const contractName = sanitizeName(
    typeof raw["contractName"] === "string" ? raw["contractName"] : "Contract",
  );

  // Bug fix: each phrase trimmed and capped at MAX_PHRASE_LEN, minimum 2 chars.
  const dynamic = contractPhrases
    .filter((p): p is string => typeof p === "string")
    .map(sanitizePhrase)
    .filter((p): p is string => p !== null);

  // Merge dynamic (contract-specific) first so they take priority in the slice.
  const allPhrases = Array.from(new Set([...dynamic, ...STATIC_PHRASES])).slice(0, MAX_PHRASES);

  let reson8Res: Response;
  try {
    // Bug fix: AbortSignal.timeout prevents hanging if Reson8 is slow.
    reson8Res = await fetch(RESON8_CUSTOM_MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `${contractName} — ${new Date().toISOString().slice(0, 10)}`,
        description:
          "Per-contract STT model. Biases transcription toward labor-law terminology and contract-specific phrases.",
        phrases: allPhrases,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return jsonError(
      502,
      isTimeout ? "Custom model service timed out" : "Custom model service unreachable",
    );
  }

  if (!reson8Res.ok) {
    const errText = await reson8Res.text().catch(() => "");
    console.error("Reson8 custom model error:", reson8Res.status, errText);
    const msg =
      reson8Res.status === 401
        ? "Invalid transcription API key"
        : `Custom model service error ${reson8Res.status}`;
    return jsonError(502, msg);
  }

  let data: unknown;
  try {
    data = await reson8Res.json();
  } catch {
    return jsonError(502, "Custom model service returned invalid JSON");
  }

  const modelId = (data as Record<string, unknown>)["id"];
  if (typeof modelId !== "string" || !modelId) {
    return jsonError(502, "Custom model service returned no ID");
  }

  return new Response(JSON.stringify({ modelId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
