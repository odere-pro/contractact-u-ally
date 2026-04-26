"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  clauseEventSchema,
  errorEventSchema,
  ocrTextEventSchema,
  stageEventSchema,
  summaryEventSchema,
} from "@/lib/catalog/schemas";
import type { AnalyzeStage, ClauseEvent, Jurisdiction, SummaryEvent } from "@/lib/catalog/types";

export type AnalysisPhase = "idle" | "running" | "done" | "error";

export interface AnalysisState {
  readonly phase: AnalysisPhase;
  readonly stage: AnalyzeStage | null;
  readonly stageProgress: number;
  readonly ocrText: string;
  readonly ocrPages: number | null;
  readonly clauses: readonly ClauseEvent[];
  readonly summary: SummaryEvent | null;
  readonly error: string | null;
  /** Wall-clock ms when this run started; null when idle. */
  readonly startedAt: number | null;
}

const INITIAL: AnalysisState = {
  phase: "idle",
  stage: null,
  stageProgress: 0,
  ocrText: "",
  ocrPages: null,
  clauses: [],
  summary: null,
  error: null,
  startedAt: null,
};

interface RunArgs {
  readonly file: File;
  readonly jurisdiction?: Jurisdiction;
  readonly typeId?: string;
}

// Discriminated union of every NDJSON event the server may emit. Every
// line received from /api/analyze is parsed through this schema; any line
// that fails to validate is silently dropped (defence against schema drift
// and against an attacker-controlled proxy injecting bogus JSON).
const serverEventSchema = z.discriminatedUnion("type", [
  stageEventSchema,
  ocrTextEventSchema,
  clauseEventSchema,
  summaryEventSchema,
  errorEventSchema,
]);
type ServerEvent = z.infer<typeof serverEventSchema>;

export function useAnalysisStream() {
  const [state, setState] = useState<AnalysisState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const mountedRef = useRef(true);

  // Tear down any in-flight fetch + reader on unmount so we don't leak
  // a TCP connection and don't fire setState on an unmounted component.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      readerRef.current?.cancel().catch(() => {});
      abortRef.current = null;
      readerRef.current = null;
    };
  }, []);

  const safeSetState = useCallback((updater: (prev: AnalysisState) => AnalysisState): void => {
    if (!mountedRef.current) return;
    setState(updater);
  }, []);

  const reset = useCallback((): void => {
    abortRef.current?.abort();
    readerRef.current?.cancel().catch(() => {});
    abortRef.current = null;
    readerRef.current = null;
    safeSetState(() => INITIAL);
  }, [safeSetState]);

  const run = useCallback(
    async (args: RunArgs): Promise<void> => {
      // Cancel any in-flight call before starting a new one.
      abortRef.current?.abort();
      readerRef.current?.cancel().catch(() => {});
      const controller = new AbortController();
      abortRef.current = controller;
      readerRef.current = null;

      safeSetState(() => ({ ...INITIAL, phase: "running", startedAt: Date.now() }));

      const form = new FormData();
      form.append("file", args.file);
      if (args.jurisdiction) form.append("jurisdiction", args.jurisdiction);
      if (args.typeId) form.append("typeId", args.typeId);

      let response: Response;
      try {
        response = await fetch("/api/analyze", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        safeSetState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "Network error",
        }));
        return;
      }

      // The fetch can resolve with a non-OK status after a newer run() has
      // already moved phase back to "running". Without this check the
      // stale error would clobber the live state.
      if (controller.signal.aborted) return;

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (controller.signal.aborted) return;
        safeSetState((s) => ({
          ...s,
          phase: "error",
          error: body.error ?? `Analyze request failed (${response.status})`,
        }));
        return;
      }

      const body = response.body;
      if (!body) {
        safeSetState((s) => ({ ...s, phase: "error", error: "Empty response stream" }));
        return;
      }

      const reader = body.getReader();
      readerRef.current = reader;
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
        safeSetState((s) => (s.phase === "error" ? s : { ...s, phase: "done" }));
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        safeSetState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "Stream read failed",
        }));
      } finally {
        if (readerRef.current === reader) readerRef.current = null;
      }

      function handleLine(raw: string): void {
        const trimmed = raw.trim();
        if (!trimmed) return;

        let candidate: unknown;
        try {
          candidate = JSON.parse(trimmed);
        } catch {
          return;
        }

        const parsed = serverEventSchema.safeParse(candidate);
        if (!parsed.success) return;

        safeSetState((prev) => applyEvent(prev, parsed.data));
      }
    },
    [safeSetState],
  );

  return { state, run, reset } as const;
}

function applyEvent(prev: AnalysisState, event: ServerEvent): AnalysisState {
  switch (event.type) {
    case "stage":
      return { ...prev, stage: event.stage, stageProgress: event.progress };
    case "ocr_text":
      return { ...prev, ocrText: event.text, ocrPages: event.pages };
    case "clause":
      return { ...prev, clauses: [...prev.clauses, event] };
    case "summary":
      return { ...prev, summary: event };
    case "error":
      // Clear stage + progress so the UI tracker can't carry a stale
      // stage from before the error arrived.
      return {
        ...prev,
        phase: "error",
        stage: null,
        stageProgress: 0,
        error: event.message,
      };
    default:
      return assertUnreachable(event);
  }
}

class UnhandledServerEventError extends Error {
  override readonly name = "UnhandledServerEventError";
}

function assertUnreachable(x: never): never {
  throw new UnhandledServerEventError(`Unhandled server event variant: ${JSON.stringify(x)}`);
}
