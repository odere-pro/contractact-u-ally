"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { AnalyzeStage } from "@/lib/catalog/types";

const STAGES: { id: "ocr" | AnalyzeStage; label: string }[] = [
  { id: "ocr", label: "OCR" },
  { id: "classify", label: "Clause segmentation" },
  { id: "load_rules", label: "Cross-checking" },
  { id: "analyze", label: "Processing" },
];

type StageId = (typeof STAGES)[number]["id"];

export type TrackerStage = StageId | "done" | "error";

interface StageTrackerProps {
  /** Active stage; "done" highlights all four; "error" stops at the failed one. */
  readonly currentStage: TrackerStage;
  /** 0..1 progress within the active stage. */
  readonly stageProgress: number;
}

function stageStatus(stageId: StageId, current: TrackerStage): "pending" | "active" | "complete" {
  if (current === "done") return "complete";
  if (current === "error") {
    // Mark the stage we got to as active, prior ones complete.
    const order: StageId[] = STAGES.map((s) => s.id);
    const currentIdx = order.findIndex((s) => s === stageId);
    return currentIdx === -1 ? "pending" : "active";
  }
  const order: StageId[] = STAGES.map((s) => s.id);
  const currentIdx = order.indexOf(current as StageId);
  const stageIdx = order.indexOf(stageId);
  if (stageIdx < currentIdx) return "complete";
  if (stageIdx === currentIdx) return "active";
  return "pending";
}

export function StageTracker({ currentStage, stageProgress }: StageTrackerProps) {
  return (
    <ol
      data-testid="stage-tracker"
      aria-label="Analysis progress"
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-stretch"
    >
      {STAGES.map((stage, idx) => {
        const status = stageStatus(stage.id, currentStage);
        return (
          <li
            key={stage.id}
            data-stage={stage.id}
            data-status={status}
            className="flex flex-1 items-center gap-3 sm:flex-col sm:items-start"
          >
            <div className="flex items-center gap-2">
              <Badge
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
                {stage.label}
              </span>
            </div>
            {status === "active" && currentStage !== "error" && (
              <div className="bg-muted relative h-1 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full transition-[width]"
                  style={{ width: `${Math.round(stageProgress * 100)}%` }}
                  data-testid={`stage-progress-${stage.id}`}
                  aria-hidden
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
