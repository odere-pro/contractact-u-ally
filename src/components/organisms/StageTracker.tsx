"use client";

import { Badge } from "@/components/ui/badge";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import type { AnalyzeStage } from "@/lib/catalog/types";

const STAGES: { id: "ocr" | AnalyzeStage; label: string }[] = [
  { id: "ocr", label: "OCR" },
  { id: "classify", label: "Clause segmentation" },
  { id: "load_rules", label: "Cross-checking" },
  { id: "analyze", label: "Processing" },
];

type StageId = (typeof STAGES)[number]["id"];

/**
 * Tracker stage. Errors carry the stage they failed on so prior stages
 * can still render as complete and the failed one as active. A bare
 * "error" with no stage falls back to marking the OCR step as the
 * failure point.
 */
export type TrackerStage = StageId | "done" | "error" | `error:${StageId}`;

interface StageTrackerProps {
  readonly currentStage: TrackerStage;
  /** 0..1 progress within the active stage. */
  readonly stageProgress: number;
}

const STAGE_ORDER: readonly StageId[] = STAGES.map((s) => s.id);

function isStageId(s: string): s is StageId {
  return (STAGE_ORDER as readonly string[]).includes(s);
}

function parseTrackerStage(s: TrackerStage): {
  active: StageId | null;
  isError: boolean;
  isDone: boolean;
} {
  if (s === "done") return { active: null, isError: false, isDone: true };
  // Bare "error" = transport-level failure with no stage in flight
  // (e.g. /api/analyze never reached). Render the error chrome but
  // mark no stage as the failure point — it's misleading to blame OCR
  // when nothing was ever attempted.
  if (s === "error") return { active: null, isError: true, isDone: false };
  if (isStageId(s)) return { active: s, isError: false, isDone: false };
  // Remaining variants: `error:${StageId}`. Use string ops, not template
  // narrowing — TS doesn't narrow startsWith() return values.
  const remainder = (s as string).slice("error:".length);
  const active = isStageId(remainder) ? remainder : (STAGE_ORDER[0] ?? null);
  return { active, isError: true, isDone: false };
}

function stageStatus(
  stageId: StageId,
  active: StageId | null,
  isDone: boolean,
): "pending" | "active" | "complete" {
  if (isDone) return "complete";
  if (active === null) return "pending";
  const activeIdx = STAGE_ORDER.indexOf(active);
  const stageIdx = STAGE_ORDER.indexOf(stageId);
  if (stageIdx < activeIdx) return "complete";
  if (stageIdx === activeIdx) return "active";
  return "pending";
}

export function StageTracker({ currentStage, stageProgress }: StageTrackerProps) {
  const { active, isError, isDone } = parseTrackerStage(currentStage);
  const safeProgress = Math.max(0, Math.min(1, stageProgress));

  return (
    <ol
      data-testid="stage-tracker"
      aria-label="Analysis progress"
      aria-busy={!isError && !isDone}
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-stretch"
    >
      {STAGES.map((stage, idx) => {
        const status = stageStatus(stage.id, active, isDone);
        const showProgressBar = status === "active" && !isError;
        return (
          <li
            key={stage.id}
            data-stage={stage.id}
            data-status={status}
            className="flex flex-1 flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <Badge
                aria-hidden
                variant={
                  status === "complete" ? "secondary" : status === "active" ? "default" : "outline"
                }
              >
                {idx + 1}
              </Badge>
              <span
                className={cn(
                  "text-sm",
                  status === "active"
                    ? "text-foreground font-medium"
                    : status === "complete"
                      ? "text-muted-foreground"
                      : "text-muted-foreground/70",
                )}
              >
                Step {idx + 1} of {STAGES.length}: {stage.label}
              </span>
            </div>
            {showProgressBar && (
              <Progress
                value={Math.round(safeProgress * 100)}
                aria-label={`${stage.label} progress`}
                data-testid={`stage-progress-${stage.id}`}
                className="motion-reduce:[&_[data-slot=progress-indicator]]:transition-none"
              >
                <ProgressLabel className="sr-only">{stage.label}</ProgressLabel>
              </Progress>
            )}
          </li>
        );
      })}
    </ol>
  );
}
