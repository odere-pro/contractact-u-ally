"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadZone } from "@/components/organisms/UploadZone";

interface OcrResponse {
  readonly filename: string;
  readonly sizeBytes: number;
  readonly parsedText: string;
}

interface OcrError {
  readonly error: string;
}

type RequestState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; data: OcrResponse }
  | { kind: "error"; message: string };

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [request, setRequest] = useState<RequestState>({ kind: "idle" });

  async function submit() {
    if (!file) return;
    setRequest({ kind: "uploading" });
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/ocr", { method: "POST", body: form });
      const body = (await response.json()) as OcrResponse | OcrError;
      if (!response.ok || "error" in body) {
        const message = "error" in body ? body.error : `Request failed (${response.status})`;
        setRequest({ kind: "error", message });
        return;
      }
      setRequest({ kind: "success", data: body });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Network error";
      setRequest({ kind: "error", message });
    }
  }

  const isUploading = request.kind === "uploading";

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-semibold tracking-tight" style={{ fontSize: "var(--text-hero)" }}>
          Know what you signed.
        </h1>
        <p className="text-muted-foreground" style={{ fontSize: "var(--text-body-lg)" }}>
          Drop your employment contract — we&apos;ll send it to OCR, then read it clause-by-clause
          against the real labor law of your country.
        </p>
      </header>

      <UploadZone disabled={isUploading} onFile={setFile} />

      <div className="flex justify-end">
        <Button data-testid="parse-cta" disabled={!file || isUploading} onClick={submit}>
          {isUploading ? "Parsing…" : "Parse contract"}
        </Button>
      </div>

      {request.kind === "error" && (
        <Alert variant="destructive" data-testid="parse-error">
          <AlertDescription>{request.message}</AlertDescription>
        </Alert>
      )}

      {request.kind === "success" && (
        <Card data-testid="parse-result">
          <CardHeader>
            <CardTitle>Parsed</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">
              <span className="font-mono">{request.data.filename}</span> · {request.data.sizeBytes}{" "}
              bytes
            </p>
            <pre className="bg-muted overflow-x-auto rounded-md p-4 font-mono text-sm whitespace-pre-wrap">
              {request.data.parsedText}
            </pre>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
