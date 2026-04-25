"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadZone } from "@/components/organisms/UploadZone";
import { StageTracker, type TrackerStage } from "@/components/organisms/StageTracker";
import { ClauseList } from "@/components/organisms/ClauseList";
import { LiveRegion } from "@/components/molecules/LiveRegion";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import type { AnalyzeStage } from "@/lib/catalog/types";

// Validate /api/ocr responses at the boundary so a server-shape change
// surfaces as a typed error instead of an "in" check that may misclassify.
const ocrSuccessSchema = z.object({
  text: z.string().min(1),
  pages: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
});
const ocrErrorSchema = z.object({ error: z.string().min(1) });
type OcrSuccess = z.infer<typeof ocrSuccessSchema>;

type OcrPhase = "idle" | "uploading" | "done" | "error";

const STAGE_ANNOUNCEMENT: Record<"ocr" | AnalyzeStage, string> = {
  ocr: "Step 1 of 4: Extracting text from your PDF.",
  classify: "Step 2 of 4: Identifying contract type.",
  load_rules: "Step 3 of 4: Loading applicable labour-law rules.",
  analyze: "Step 4 of 4: Analyzing clauses.",
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [ocrPhase, setOcrPhase] = useState<OcrPhase>("idle");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const { state: analysis, run, reset } = useAnalysisStream();

  const alertRef = useRef<HTMLDivElement>(null);
  const findingsTitleRef = useRef<HTMLDivElement>(null);
  // Owns the in-flight OCR fetch so picking a different file mid-upload
  // can cancel it cleanly instead of resolving onto stale state.
  const ocrAbortRef = useRef<AbortController | null>(null);

  // Tear down a pending OCR fetch on unmount so we don't leak a TCP
  // connection or call setState after the page unmounts.
  useEffect(() => {
    return () => {
      ocrAbortRef.current?.abort();
      ocrAbortRef.current = null;
    };
  }, []);

  function pickFile(next: File): void {
    ocrAbortRef.current?.abort();
    ocrAbortRef.current = null;
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

    ocrAbortRef.current?.abort();
    const controller = new AbortController();
    ocrAbortRef.current = controller;

    let ocr: OcrSuccess;
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/ocr", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const raw: unknown = await response.json();
      const success = ocrSuccessSchema.safeParse(raw);
      if (response.ok && success.success) {
        ocr = success.data;
        setOcrPhase("done");
      } else {
        const errBody = ocrErrorSchema.safeParse(raw);
        const message = errBody.success ? errBody.data.error : `OCR failed (${response.status})`;
        setOcrError(message);
        setOcrPhase("error");
        return;
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setOcrError(error instanceof Error ? error.message : "Network error");
      setOcrPhase("error");
      return;
    } finally {
      if (ocrAbortRef.current === controller) ocrAbortRef.current = null;
    }

    await run({ ocrText: ocr.text, jurisdiction: "nl" });
  }

  const trackerStage: TrackerStage = computeTrackerStage(ocrPhase, analysis.phase, analysis.stage);
  const trackerProgress = ocrPhase === "uploading" ? 0.4 : analysis.stageProgress;
  const isWorking = ocrPhase === "uploading" || analysis.phase === "running";
  const showTracker = ocrPhase !== "idle";
  const showError = ocrError ?? analysis.error;
  const showFindings = analysis.clauses.length > 0 || analysis.summary !== null;

  // Compose the live-region message from current state. Errors have their
  // own role="alert" — skip duplicate announcement here.
  const liveMessage = computeLiveMessage(ocrPhase, analysis, !!showError);

  // On error → focus the Alert (which already has role="alert" so it
  // also self-announces). On done → focus the Findings card title so
  // keyboard + AT users land on the new content instead of the now-
  // disabled Analyze button.
  useEffect(() => {
    if (showError && alertRef.current) {
      alertRef.current.focus();
    }
  }, [showError]);

  useEffect(() => {
    if (analysis.phase === "done" && findingsTitleRef.current) {
      findingsTitleRef.current.focus();
    }
  }, [analysis.phase]);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <LiveRegion message={liveMessage} />

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
        <Button
          data-testid="parse-cta"
          aria-disabled={!file || isWorking}
          onClick={(e) => {
            // Use aria-disabled (not disabled) so AT can still read the
            // button's name when it changes to "Analyzing…", and so focus
            // is preserved across the click.
            if (!file || isWorking) {
              e.preventDefault();
              return;
            }
            void submit();
          }}
        >
          {isWorking ? "Analyzing…" : "Analyze contract"}
        </Button>
      </div>

      {showTracker && <StageTracker currentStage={trackerStage} stageProgress={trackerProgress} />}

      {showError && (
        <Alert ref={alertRef} tabIndex={-1} variant="destructive" data-testid="analyze-error">
          <AlertDescription>{showError}</AlertDescription>
        </Alert>
      )}

      {showFindings && (
        <Card data-testid="analyze-result">
          <CardHeader>
            <CardTitle ref={findingsTitleRef} tabIndex={-1}>
              Findings
            </CardTitle>
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

function computeLiveMessage(
  ocrPhase: OcrPhase,
  analysis: ReturnType<typeof useAnalysisStream>["state"],
  hasError: boolean,
): string | null {
  if (hasError) return null;
  if (analysis.phase === "done" && analysis.summary) {
    const s = analysis.summary;
    return `Analysis complete. ${s.totalClauses} clauses analyzed, ${s.illegalCount} illegal, ${s.exploitativeCount} exploitative.`;
  }
  if (analysis.phase === "running" && analysis.stage) return STAGE_ANNOUNCEMENT[analysis.stage];
  if (ocrPhase === "uploading") return STAGE_ANNOUNCEMENT.ocr;
  return null;
}
