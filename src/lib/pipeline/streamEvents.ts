import "server-only";

import type {
  AnalyzeStage,
  ClauseEvent,
  ErrorEvent,
  OcrTextEvent,
  StageEvent,
  SummaryEvent,
} from "@/lib/catalog/types";

const encoder = new TextEncoder();

function encode(obj: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(obj) + "\n");
}

export function encodeStage(stage: AnalyzeStage, progress: number): Uint8Array {
  const event: StageEvent = { type: "stage", stage, progress };
  return encode(event);
}

export function encodeOcrText(text: string, pages: number): Uint8Array {
  const event: OcrTextEvent = { type: "ocr_text", text, pages };
  return encode(event);
}

export function encodeClause(clause: ClauseEvent): Uint8Array {
  return encode(clause);
}

export function encodeSummary(summary: SummaryEvent): Uint8Array {
  return encode(summary);
}

export function encodeError(message: string): Uint8Array {
  const event: ErrorEvent = { type: "error", message };
  return encode(event);
}
