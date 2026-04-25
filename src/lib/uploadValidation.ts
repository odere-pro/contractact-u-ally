export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

type MagicSignature = {
  mime: AllowedMimeType;
  bytes: readonly number[];
};

// text/plain has no canonical magic — we accept it on declared-MIME alone.
const MAGIC_SIGNATURES: readonly MagicSignature[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  {
    mime: "image/png",
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
];

export function detectMimeFromMagicBytes(head: Uint8Array): AllowedMimeType | null {
  for (const { mime, bytes } of MAGIC_SIGNATURES) {
    if (head.length < bytes.length) continue;
    let matches = true;
    for (let i = 0; i < bytes.length; i++) {
      if (head[i] !== bytes[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return mime;
  }
  return null;
}

export type UploadCandidate = {
  declaredMime: string;
  sizeBytes: number;
  head: Uint8Array;
};

export type UploadValidationFailure = "empty" | "too_large" | "mime_not_allowed" | "magic_mismatch";

export type UploadValidationResult = { ok: true } | { ok: false; reason: UploadValidationFailure };

function isAllowedMime(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export function validateUpload(candidate: UploadCandidate): UploadValidationResult {
  if (candidate.sizeBytes <= 0) return { ok: false, reason: "empty" };
  if (candidate.sizeBytes > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  if (!isAllowedMime(candidate.declaredMime)) return { ok: false, reason: "mime_not_allowed" };

  // text/plain has no canonical magic-byte signature, but we still confirm
  // the head decodes as valid UTF-8. A renamed binary will fail the fatal
  // decode and be rejected as magic_mismatch.
  if (candidate.declaredMime === "text/plain") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(candidate.head);
      return { ok: true };
    } catch {
      return { ok: false, reason: "magic_mismatch" };
    }
  }

  const detected = detectMimeFromMagicBytes(candidate.head);
  if (detected !== candidate.declaredMime) return { ok: false, reason: "magic_mismatch" };

  return { ok: true };
}
