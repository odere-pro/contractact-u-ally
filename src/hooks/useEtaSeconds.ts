"use client";

import { useEffect, useState } from "react";

import type { AnalyzeStage } from "@/lib/catalog/types";

const STAGE_ORDER: readonly AnalyzeStage[] = ["ocr", "classify", "load_rules", "analyze"] as const;
const TOTAL_STAGES = STAGE_ORDER.length;
const ETA_TICK_MS = 1000;
const MIN_ELAPSED_MS_FOR_ETA = 750;

export interface EtaInputs {
  readonly startedAt: number | null;
  readonly isWorking: boolean;
  readonly stage: AnalyzeStage | null;
  readonly stageProgress: number;
}

// Re-renders once per second while running so the displayed ETA decays
// smoothly even between server stage events. The interval callback is the
// "external system" the effect synchronizes with — Date.now() is read
// inside that callback (allowed) and stored in state. Returns null until
// enough elapsed time has passed to make an extrapolation worthwhile.
export function useEtaSeconds({
  startedAt,
  isWorking,
  stage,
  stageProgress,
}: EtaInputs): number | null {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isWorking) return;
    const handle = window.setInterval(() => setNow(Date.now()), ETA_TICK_MS);
    return () => window.clearInterval(handle);
  }, [isWorking]);

  if (!isWorking || startedAt === null) return null;
  const elapsedMs = Math.max(0, now - startedAt);
  if (elapsedMs < MIN_ELAPSED_MS_FOR_ETA) return null;

  const stageIdx = stage ? STAGE_ORDER.indexOf(stage) : 0;
  const safeProgress = Math.max(0, Math.min(1, stageProgress));
  const overall = (stageIdx + safeProgress) / TOTAL_STAGES;
  if (overall <= 0 || overall >= 1) return null;

  const totalMs = elapsedMs / overall;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  return Math.round(remainingMs / 1000);
}
