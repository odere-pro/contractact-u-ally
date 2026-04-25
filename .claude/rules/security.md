# Security rules (immigration documents = sensitive)

- Never log document contents, filenames, or user PII.
- Never persist uploads to disk unless the user explicitly opted in (S3 path).
- All uploads validated: MIME type allowlist, size cap, magic-byte check.
- Anthropic/Gemini keys only in server code. Never expose to the client bundle.
- CSP headers on all pages. No inline scripts.
- Rate-limit `/api/extract` and `/api/match` per IP — protect the model budget.
- Strip EXIF / metadata from images before processing.
- Error responses must not echo input back to the client.
