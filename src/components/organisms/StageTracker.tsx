"use client";

import { AlertCircle, CheckCircle2, Circle, CircleDot, Info } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import type { AnalyzeStage, Jurisdiction } from "@/lib/catalog/types";

const STAGES: readonly AnalyzeStage[] = ["ocr", "classify", "load_rules", "analyze"] as const;

type StageId = AnalyzeStage;

/**
 * Tracker stage. Errors carry the stage they failed on so prior stages
 * still render as complete and the failed one as the error point. A bare
 * "error" with no stage = transport-level failure (request never reached
 * a stage event); the failure point is intentionally unattributed.
 */
export type TrackerStage = StageId | "done" | "error" | `error:${StageId}`;

const JURISDICTION_LABEL: Record<Jurisdiction, string> = { nl: "Dutch" };

interface StageTrackerProps {
  readonly currentStage: TrackerStage;
  /** 0..1 progress within the active stage. */
  readonly stageProgress: number;
  readonly fileName?: string;
  readonly jurisdiction?: Jurisdiction;
  readonly ocrPages?: number;
  readonly ocrWordCount?: number;
  /** Estimated seconds remaining; when null/undefined the ETA chip is hidden. */
  readonly etaSeconds?: number | null;
}

interface ParsedStage {
  readonly active: StageId | null;
  readonly isError: boolean;
  readonly isDone: boolean;
}

type StepStatus = "pending" | "active" | "complete" | "error";

function isStageId(s: string): s is StageId {
  return (STAGES as readonly string[]).includes(s);
}

export function parseTrackerStage(s: TrackerStage): ParsedStage {
  if (s === "done") return { active: null, isError: false, isDone: true };
  if (s === "error") return { active: null, isError: true, isDone: false };
  if (isStageId(s)) return { active: s, isError: false, isDone: false };
  // Remaining variant: `error:${StageId}`. Use string ops because TS does
  // not narrow startsWith() return values.
  const remainder = (s as string).slice("error:".length);
  const active = isStageId(remainder) ? remainder : (STAGES[0] ?? null);
  return { active, isError: true, isDone: false };
}

export function stepStatus(stageId: StageId, parsed: ParsedStage): StepStatus {
  const { active, isDone, isError } = parsed;
  if (isDone) return "complete";
  if (active === null) return "pending";
  const activeIdx = STAGES.indexOf(active);
  const stageIdx = STAGES.indexOf(stageId);
  if (stageIdx < activeIdx) return "complete";
  if (stageIdx === activeIdx) return isError ? "error" : "active";
  return "pending";
}

export function overallPercent(parsed: ParsedStage, stageProgress: number): number {
  if (parsed.isDone) return 100;
  if (parsed.active === null) return 0;
  const idx = STAGES.indexOf(parsed.active);
  const safe = Math.max(0, Math.min(1, stageProgress));
  return Math.round(((idx + safe) / STAGES.length) * 100);
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "almost done";
  if (seconds < 5) return "less than 5 seconds remaining";
  const rounded = Math.round(seconds / 5) * 5;
  return `roughly ${rounded} seconds remaining`;
}

interface LabelCtx {
  readonly jurisdiction?: Jurisdiction;
  readonly ocrPages?: number;
  readonly ocrWordCount?: number;
}

export function stepLabel(stageId: StageId, status: StepStatus, ctx: LabelCtx): string {
  const jurisdictionName = ctx.jurisdiction ? JURISDICTION_LABEL[ctx.jurisdiction] : null;
  switch (stageId) {
    case "ocr":
      if (status === "complete" && ctx.ocrPages != null && ctx.ocrWordCount != null) {
        const pageWord = ctx.ocrPages === 1 ? "page" : "pages";
        return `OCR complete (${ctx.ocrPages} ${pageWord}, ${ctx.ocrWordCount.toLocaleString()} words)`;
      }
      return status === "active" ? "Reading PDF…" : "Reading PDF";
    case "classify":
      return status === "active" ? "Clause segmentation…" : "Clause segmentation";
    case "load_rules": {
      const subject = jurisdictionName ? `${jurisdictionName} labor law` : "labor law";
      return status === "active"
        ? `Cross-checking against ${subject}…`
        : `Cross-checking against ${subject}`;
    }
    case "analyze":
      return status === "active"
        ? "Drafting plain-language summary…"
        : "Drafting plain-language summary";
  }
}

function StatusIcon({ status }: { readonly status: StepStatus }) {
  if (status === "complete") {
    return <CheckCircle2 aria-hidden className="size-5 shrink-0 text-[color:var(--color-ok)]" />;
  }
  if (status === "active") {
    return <CircleDot aria-hidden className="text-primary size-5 shrink-0" />;
  }
  if (status === "error") {
    return <AlertCircle aria-hidden className="text-destructive size-5 shrink-0" />;
  }
  return <Circle aria-hidden className="text-muted-foreground/40 size-5 shrink-0" />;
}

function trackerTitle(parsed: ParsedStage, fileName?: string): string {
  const subject = fileName ?? "your contract";
  if (parsed.isError) return `Couldn't finish reading ${subject}`;
  if (parsed.isDone) return `Done reading ${subject}`;
  return `Reading ${subject} …`;
}

function statusLine(parsed: ParsedStage, percent: number, etaSeconds?: number | null): string {
  if (parsed.isError) return "Stopped";
  if (parsed.isDone) return "100% · finished";
  if (etaSeconds != null && etaSeconds > 0) return `${percent}% · ${formatEta(etaSeconds)}`;
  return `${percent}%`;
}

export function StageTracker({
  currentStage,
  stageProgress,
  fileName,
  jurisdiction,
  ocrPages,
  ocrWordCount,
  etaSeconds,
}: StageTrackerProps) {
  const parsed = parseTrackerStage(currentStage);
  const percent = overallPercent(parsed, stageProgress);
  const labelCtx: LabelCtx = { jurisdiction, ocrPages, ocrWordCount };

  return (
    <section
      data-testid="stage-tracker"
      data-state={parsed.isError ? "error" : parsed.isDone ? "done" : "running"}
      aria-busy={!parsed.isError && !parsed.isDone}
      aria-label="Analysis progress"
      className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5"
    >
      <header className="flex flex-col gap-2">
        <h2
          className="text-foreground text-base font-semibold tracking-tight"
          data-testid="tracker-title"
        >
          {trackerTitle(parsed, fileName)}
        </h2>
        <Progress
          value={percent}
          aria-label="Overall analysis progress"
          data-testid="tracker-overall"
          className="motion-reduce:[&_[data-slot=progress-indicator]]:transition-none"
        />
        <p className="text-muted-foreground text-sm" data-testid="tracker-status-line">
          {statusLine(parsed, percent, etaSeconds)}
        </p>
      </header>

      <ol className="flex flex-col gap-2.5" data-testid="tracker-steps">
        {STAGES.map((stageId) => {
          const status = stepStatus(stageId, parsed);
          return (
            <li
              key={stageId}
              data-stage={stageId}
              data-status={status}
              className="flex items-center gap-3"
            >
              <StatusIcon status={status} />
              <span
                className={cn(
                  "text-sm",
                  status === "active" && "text-foreground font-medium",
                  status === "complete" && "text-foreground",
                  status === "pending" && "text-muted-foreground/70",
                  status === "error" && "text-destructive font-medium",
                )}
              >
                {stepLabel(stageId, status, labelCtx)}
              </span>
            </li>
          );
        })}
      </ol>

      {!parsed.isError && !parsed.isDone && (
        <p
          className="text-muted-foreground flex items-start gap-2 text-xs"
          data-testid="tracker-footer-note"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            This usually takes 20–40 seconds. You can leave this tab open — we&apos;ll notify you.
          </span>
        </p>
      )}
    </section>
  );
}
