"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadZone } from "@/components/organisms/UploadZone";
import { StageTracker, type TrackerStage } from "@/components/organisms/StageTracker";
import { ResultsLayout } from "@/components/organisms/ResultsLayout";
import { ErrorBoundary } from "@/components/organisms/ErrorBoundary";
import { LanguageSwitcher } from "@/components/molecules/LanguageSwitcher";
import { LiveRegion } from "@/components/molecules/LiveRegion";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import { useEtaSeconds } from "@/hooks/useEtaSeconds";
import { useTranslatedAnalysis } from "@/hooks/useTranslatedAnalysis";
import { useVoice } from "@/hooks/useVoice";
import type { AnalyzeStage, Jurisdiction } from "@/lib/catalog/types";

const JURISDICTION: Jurisdiction = "nl";

const STAGE_ANNOUNCEMENT: Record<AnalyzeStage, string> = {
  ocr: "Step 1 of 4: Extracting text from your PDF.",
  classify: "Step 2 of 4: Identifying contract type.",
  load_rules: "Step 3 of 4: Loading applicable labour-law rules.",
  analyze: "Step 4 of 4: Analyzing clauses.",
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const { state: analysis, run, reset } = useAnalysisStream();

  const alertRef = useRef<HTMLDivElement>(null);
  const findingsTitleRef = useRef<HTMLHeadingElement>(null);

  const voice = useVoice({ jurisdiction: JURISDICTION, clauses: analysis.clauses });

  const pickFile = useCallback(
    (next: File): void => {
      setFile(next);
      reset();
    },
    [reset],
  );

  const submit = useCallback(async (): Promise<void> => {
    if (!file) return;
    reset();
    await run({ file, jurisdiction: JURISDICTION });
  }, [file, run, reset]);

  const startOver = useCallback((): void => {
    reset();
    setFile(null);
  }, [reset]);

  const trackerStage: TrackerStage = computeTrackerStage(analysis.phase, analysis.stage);
  const trackerProgress = analysis.stageProgress;
  const isWorking = analysis.phase === "running";
  const showTracker = analysis.phase !== "idle";
  const errorMessage = analysis.error;
  const showError = errorMessage !== null;
  const showFindings = analysis.clauses.length > 0 || analysis.summary !== null;

  const ocrWordCount = useMemo(() => countWords(analysis.ocrText), [analysis.ocrText]);
  const etaSeconds = useEtaSeconds({
    startedAt: analysis.startedAt,
    isWorking,
    stage: analysis.stage,
    stageProgress: analysis.stageProgress,
  });

  const liveMessage = computeLiveMessage(analysis, showError);

  // Translation overlay. The hook returns the original ocrText/clauses
  // when language === "en" (or while a translation is in flight), so the
  // results UI never sees a partially-translated state.
  const translated = useTranslatedAnalysis({
    ocrText: analysis.ocrText,
    clauses: analysis.clauses,
    ready: analysis.phase === "done",
  });

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

  // Build a per-contract Reson8 STT custom model in parallel once analysis
  // completes so voice questions are biased toward this contract's vocabulary.
  useEffect(() => {
    if (analysis.phase === "done" && voice.modelState === "none") {
      void voice.buildModel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis.phase]);

  // Results mode: viewport-takeover 3-pane. The upload UI, dropzone,
  // and tracker collapse into a thin toolbar so the analysis owns the
  // screen and the contract column gets enough width to render
  // readable line breaks (the prior layout clamped to max-w-3xl which
  // chopped OCR text into one word per line).
  if (showFindings) {
    return (
      <div
        className="bg-secondary flex min-h-0 flex-1 flex-col"
        data-testid="results-mode"
        style={{ animation: "fade-in var(--duration-normal) var(--ease-out-expo)" }}
      >
        <LiveRegion message={liveMessage} />

        <div className="border-border bg-background flex flex-wrap items-center gap-3 border-b px-4 py-2">
          <Button
            data-testid="start-over"
            size="sm"
            variant="ghost"
            onClick={startOver}
            className="-ml-2"
          >
            <ArrowLeft aria-hidden className="size-4" />
            New contract
          </Button>
          {/* h1 is sr-only — kept for landmark semantics + focus
              management on `done`, but visually removed from the toolbar
              to reduce chrome. tabIndex=-1 lets the effect move focus
              here without making it tab-reachable. */}
          <h1 ref={findingsTitleRef} tabIndex={-1} className="sr-only outline-none">
            Findings.{" "}
            {analysis.summary
              ? `${analysis.summary.totalClauses} clauses, ${analysis.summary.illegalCount} illegal.`
              : `${analysis.clauses.length} streaming.`}
          </h1>
          <span className="grow" />
          <LanguageSwitcher
            current={translated.language}
            pending={translated.pending}
            onChange={translated.setLanguage}
          />
        </div>

        {translated.error && (
          <Alert variant="destructive" data-testid="translate-error" className="mx-4 mt-2">
            <AlertDescription>{translated.error}</AlertDescription>
          </Alert>
        )}

        <div className="min-h-0 flex-1" data-testid="analyze-result">
          <ErrorBoundary
            fallback={(error, reset) => (
              <div className="mx-auto flex max-w-2xl flex-col gap-3 px-6 py-12">
                <Alert variant="destructive" data-testid="results-error-fallback">
                  <AlertTitle>The results pane crashed.</AlertTitle>
                  <AlertDescription>
                    Your contract is still loaded — try again, or start over with a fresh upload.
                    {error.message ? ` (${error.message})` : ""}
                  </AlertDescription>
                </Alert>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={startOver}>
                    Start over
                  </Button>
                  <Button onClick={reset}>Try again</Button>
                </div>
              </div>
            )}
          >
            <ResultsLayout
              ocrText={translated.ocrText}
              clauses={translated.clauses}
              summary={analysis.summary}
              voice={voice}
            />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-6 overflow-y-auto px-6 py-12">
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

      {showTracker && (
        <StageTracker
          currentStage={trackerStage}
          stageProgress={trackerProgress}
          fileName={file?.name}
          jurisdiction={JURISDICTION}
          ocrPages={analysis.ocrPages ?? undefined}
          ocrWordCount={ocrWordCount ?? undefined}
          etaSeconds={etaSeconds}
        />
      )}

      {showError && (
        <Alert ref={alertRef} tabIndex={-1} variant="destructive" data-testid="analyze-error">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

function computeTrackerStage(
  analysisPhase: ReturnType<typeof useAnalysisStream>["state"]["phase"],
  analysisStage: ReturnType<typeof useAnalysisStream>["state"]["stage"],
): TrackerStage {
  if (analysisPhase === "error") {
    // No stage in flight = transport-level failure (request never
    // reached a stage event). Bare "error" tells StageTracker to render
    // the error chrome without blaming a specific stage.
    return analysisStage ? `error:${analysisStage}` : "error";
  }
  if (analysisPhase === "running") return analysisStage ?? "ocr";
  if (analysisPhase === "done") return "done";
  return "ocr";
}

function computeLiveMessage(
  analysis: ReturnType<typeof useAnalysisStream>["state"],
  hasError: boolean,
): string | null {
  if (hasError) return null;
  if (analysis.phase === "done" && analysis.summary) {
    const s = analysis.summary;
    return `Analysis complete. ${s.totalClauses} clauses analyzed, ${s.illegalCount} illegal, ${s.exploitativeCount} exploitative.`;
  }
  if (analysis.phase === "running" && analysis.stage) return STAGE_ANNOUNCEMENT[analysis.stage];
  return null;
}

function countWords(text: string): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/).length;
}
