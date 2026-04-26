"use client";

import { useCallback, useRef, useState } from "react";
import type { ClauseEvent } from "@/lib/catalog/types";

export type VoiceState = "idle" | "listening" | "processing" | "response" | "error";
export type ModelState = "none" | "building" | "ready" | "failed";

export interface UseVoiceOptions {
  readonly jurisdiction: string;
  readonly clauses: readonly ClauseEvent[];
}

export interface UseVoiceReturn {
  readonly voiceState: VoiceState;
  readonly modelState: ModelState;
  readonly customModelId: string | null;
  readonly transcript: string;
  readonly answer: string;
  // ID of the clause that initiated the current voice session. The
  // recording is shared across the page (one mic at a time), so this
  // tells each ClauseCard whether the active session is "theirs".
  readonly activeClauseId: string | null;
  buildModel: () => Promise<void>;
  startListening: (clauseId?: string) => Promise<void>;
  stopAndProcess: () => Promise<void>;
  cancel: () => void;
  dismiss: () => void;
}

export function useVoice({ jurisdiction, clauses }: UseVoiceOptions): UseVoiceReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [modelState, setModelState] = useState<ModelState>("none");
  const [customModelId, setCustomModelId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [activeClauseId, setActiveClauseId] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Stable refs so recorder.onstop closure always reads current values.
  const jurisdictionRef = useRef(jurisdiction);
  const clausesRef = useRef(clauses);
  const customModelIdRef = useRef(customModelId);
  jurisdictionRef.current = jurisdiction;
  clausesRef.current = clauses;
  customModelIdRef.current = customModelId;

  const buildModel = useCallback(async () => {
    setModelState("building");
    try {
      const phrases = [
        ...clausesRef.current.map((c) => c.title).filter(Boolean),
        ...clausesRef.current.flatMap((c) =>
          c.citation ? [c.citation.article, c.citation.label] : [],
        ),
      ].filter(Boolean);

      const res = await fetch("/api/reson8-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractPhrases: phrases,
          contractName: `${jurisdictionRef.current.toUpperCase()} contract`,
        }),
      });
      if (!res.ok) {
        setModelState("failed");
        return;
      }
      const { modelId } = (await res.json()) as { modelId?: string };
      if (modelId) {
        setCustomModelId(modelId);
        setModelState("ready");
      } else {
        setModelState("failed");
      }
    } catch {
      setModelState("failed");
    }
  }, []);

  const startListening = useCallback(async (clauseId?: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      setActiveClauseId(clauseId ?? null);
      // Clear any prior answer so the new session starts clean.
      setTranscript("");
      setAnswer("");
      setVoiceState("listening");
    } catch {
      setVoiceState("idle");
      setActiveClauseId(null);
    }
  }, []);

  const stopAndProcess = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });
    recorderRef.current = null;

    if (chunksRef.current.length === 0) {
      setVoiceState("idle");
      return;
    }

    setVoiceState("processing");

    const mimeType = recorder.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    const form = new FormData();
    form.set("audio", blob, "recording.webm");
    form.set(
      "context",
      JSON.stringify({ jurisdiction: jurisdictionRef.current, clauses: clausesRef.current }),
    );
    if (customModelIdRef.current) {
      form.set("customModelId", customModelIdRef.current);
    }

    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error("transcribe_failed");
      const data = (await res.json()) as { transcript?: string; reasoning?: string };
      setTranscript(data.transcript ?? "");
      setAnswer(data.reasoning ?? data.transcript ?? "");
      setVoiceState("response");
    } catch {
      setVoiceState("error");
    }
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      try {
        recorder.stop();
        recorder.stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* already stopped */
      }
      recorderRef.current = null;
    }
    setActiveClauseId(null);
    setVoiceState("idle");
  }, []);

  const dismiss = useCallback(() => {
    setTranscript("");
    setAnswer("");
    setActiveClauseId(null);
    setVoiceState("idle");
  }, []);

  return {
    voiceState,
    modelState,
    customModelId,
    transcript,
    answer,
    activeClauseId,
    buildModel,
    startListening,
    stopAndProcess,
    cancel,
    dismiss,
  };
}
