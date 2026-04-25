"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadZone } from "@/components/organisms/UploadZone";
import { StageTracker, type TrackerStage } from "@/components/organisms/StageTracker";
import { ClauseList } from "@/components/organisms/ClauseList";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";

interface OcrSuccess {
  readonly text: string;
  readonly pages: number;
  readonly durationMs: number;
}

interface OcrError {
  readonly error: string;
}

type OcrPhase = "idle" | "uploading" | "done" | "error";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [ocrPhase, setOcrPhase] = useState<OcrPhase>("idle");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const { state: analysis, run, reset } = useAnalysisStream();

  function pickFile(next: File): void {
    setFile(next);
    setOcrError(null);
    setOcrPhase("idle");
    reset();
  }

  async function submit(): Promise<void> {
    if (!file) return;
    setOcrError(null);
    setOcrPhase("uploading");
    reset();

    let ocr: OcrSuccess;
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/ocr", { method: "POST", body: form });
      const body = (await response.json()) as OcrSuccess | OcrError;
      if (!response.ok || "error" in body) {
        const message = "error" in body ? body.error : `OCR failed (${response.status})`;
        setOcrError(message);
        setOcrPhase("error");
        return;
      }
      ocr = body;
      setOcrPhase("done");
    } catch (error: unknown) {
      setOcrError(error instanceof Error ? error.message : "Network error");
      setOcrPhase("error");
      return;
    }

    await run({ ocrText: ocr.text, jurisdiction: "nl" });
  }

  const trackerStage: TrackerStage = computeTrackerStage(ocrPhase, analysis.phase, analysis.stage);
  const trackerProgress = ocrPhase === "uploading" ? 0.4 : analysis.stageProgress;
  const isWorking = ocrPhase === "uploading" || analysis.phase === "running";
  const showTracker = ocrPhase !== "idle";
  const showError = ocrError ?? analysis.error;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-semibold tracking-tight" style={{ fontSize: "var(--text-hero)" }}>
          Know what you signed.
        </h1>
        <p className="text-muted-foreground" style={{ fontSize: "var(--text-body-lg)" }}>
          Drop your employment contract — we&apos;ll OCR it, then read it clause-by-clause against
          the real labor law of your country.
        </p>
      </header>

      <UploadZone disabled={isWorking} onFile={pickFile} />

      <div className="flex justify-end">
        <Button data-testid="parse-cta" disabled={!file || isWorking} onClick={submit}>
          {isWorking ? "Analyzing…" : "Analyze contract"}
        </Button>
      </div>

      {showTracker && <StageTracker currentStage={trackerStage} stageProgress={trackerProgress} />}

      {showError && (
        <Alert variant="destructive" data-testid="analyze-error">
          <AlertDescription>{showError}</AlertDescription>
        </Alert>
      )}

      {(analysis.clauses.length > 0 || analysis.summary) && (
        <Card data-testid="analyze-result">
          <CardHeader>
            <CardTitle>Findings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {analysis.summary && (
              <p className="text-muted-foreground text-sm">
                {analysis.summary.totalClauses} clauses analyzed ·{" "}
                <strong className="text-destructive">{analysis.summary.illegalCount}</strong>{" "}
                illegal · {analysis.summary.exploitativeCount} exploitative ·{" "}
                {analysis.summary.compliantCount} compliant
              </p>
            )}
            <ClauseList clauses={analysis.clauses} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function computeTrackerStage(
  ocrPhase: OcrPhase,
  analysisPhase: ReturnType<typeof useAnalysisStream>["state"]["phase"],
  analysisStage: ReturnType<typeof useAnalysisStream>["state"]["stage"],
): TrackerStage {
  if (ocrPhase === "error") return "error:ocr";
  if (analysisPhase === "error") return `error:${analysisStage ?? "classify"}`;
  if (ocrPhase === "uploading") return "ocr";
  if (analysisPhase === "running") return analysisStage ?? "classify";
  if (analysisPhase === "done") return "done";
  return "ocr";
}
