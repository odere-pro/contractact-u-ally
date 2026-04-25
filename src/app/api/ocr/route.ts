import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "text/plain"]);

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart payload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 10MB" }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  // OCR provider integration is intentionally out of scope for this scaffold.
  // This stub returns a deterministic placeholder so the upload → server flow
  // can be smoke-tested end-to-end before wiring a real OCR backend.
  return NextResponse.json({
    filename: file.name,
    sizeBytes: file.size,
    parsedText: "[stub] OCR pipeline not yet wired. File received successfully.",
  });
}
