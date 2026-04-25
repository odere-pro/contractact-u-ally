"use client";

import { useCallback, useRef, useState } from "react";

import type { AnalyzeStage, ClauseEvent, Jurisdiction, SummaryEvent } from "@/lib/catalog/types";

export type AnalysisPhase = "idle" | "running" | "done" | "error";

export interface AnalysisState {
  readonly phase: AnalysisPhase;
  readonly stage: AnalyzeStage | null;
  readonly stageProgress: number;
  readonly clauses: readonly ClauseEvent[];
  readonly summary: SummaryEvent | null;
  readonly error: string | null;
}

const INITIAL: AnalysisState = {
  phase: "idle",
  stage: null,
  stageProgress: 0,
  clauses: [],
  summary: null,
  error: null,
};

interface RunArgs {
  readonly ocrText: string;
  readonly jurisdiction?: Jurisdiction;
  readonly typeId?: string;
}

type ServerEvent =
  | { type: "stage"; stage: AnalyzeStage; progress: number }
  | (ClauseEvent & { type: "clause" })
  | (SummaryEvent & { type: "summary" })
  | { type: "error"; message: string };

/**
 * Drive the /api/analyze NDJSON stream.
 *
 * Caller invokes `run({ ocrText })` and renders against the returned state.
 * State updates immutably as `stage`, `clause`, `summary`, and `error`
 * events arrive. Calling `reset()` clears state for a new contract.
 */
export function useAnalysisStream() {
  const [state, setState] = useState<AnalysisState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const run = useCallback(async (args: RunArgs): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...INITIAL, phase: "running" });

    let response: Response;
    try {
      response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "Network error",
      }));
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setState((s) => ({
        ...s,
        phase: "error",
        error: body.error ?? `Analyze request failed (${response.status})`,
      }));
      return;
    }

    const body = response.body;
    if (!body) {
      setState((s) => ({ ...s, phase: "error", error: "Empty response stream" }));
      return;
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          handleLine(line);
        }
      }
      if (buf.trim()) handleLine(buf);
      setState((s) => (s.phase === "error" ? s : { ...s, phase: "done" }));
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "Stream read failed",
      }));
    }

    function handleLine(raw: string): void {
      const trimmed = raw.trim();
      if (!trimmed) return;
      let event: ServerEvent;
      try {
        event = JSON.parse(trimmed) as ServerEvent;
      } catch {
        return;
      }
      setState((prev) => applyEvent(prev, event));
    }
  }, []);

  return { state, run, reset } as const;
}

function applyEvent(prev: AnalysisState, event: ServerEvent): AnalysisState {
  switch (event.type) {
    case "stage":
      return { ...prev, stage: event.stage, stageProgress: event.progress };
    case "clause":
      return { ...prev, clauses: [...prev.clauses, event] };
    case "summary":
      return { ...prev, summary: event };
    case "error":
      return { ...prev, phase: "error", error: event.message };
  }
}
