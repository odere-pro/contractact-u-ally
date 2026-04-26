"use client";

import { useCallback, useRef, useState } from "react";
import type { ClauseEvent } from "@/lib/catalog/types";

export type VoiceState = "idle" | "listening" | "processing" | "streaming" | "response" | "error";
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
  askWithText: (clauseId: string, question: string) => Promise<void>;
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
  // Lets `dismiss()` cut off an in-flight SSE answer when the user
  // closes the dialog mid-stream.
  const answerAbortRef = useRef<AbortController | null>(null);

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

  // Streams SSE deltas from /api/answer into local `answer` state.
  // Resolves on `done`; rejects on `error` or transport failure.
  const streamAnswer = useCallback(async (question: string): Promise<void> => {
    const controller = new AbortController();
    answerAbortRef.current = controller;

    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        jurisdiction: jurisdictionRef.current,
        clauses: clausesRef.current,
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) throw new Error("answer_failed");

    setVoiceState("streaming");
    setAnswer("");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; parse complete frames
        // and leave the partial tail in `buffer` for the next chunk.
        let separator = buffer.indexOf("\n\n");
        while (separator !== -1) {
          const rawFrame = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          separator = buffer.indexOf("\n\n");

          let event = "message";
          let data = "";
          for (const line of rawFrame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;

          if (event === "delta") {
            try {
              const { text } = JSON.parse(data) as { text?: string };
              if (text) setAnswer((prev) => prev + text);
            } catch {
              /* ignore malformed frame */
            }
          } else if (event === "done") {
            return;
          } else if (event === "error") {
            throw new Error("stream_error");
          }
        }
      }
    } finally {
      answerAbortRef.current = null;
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
    if (customModelIdRef.current) {
      form.set("customModelId", customModelIdRef.current);
    }

    let sttTranscript = "";
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error("transcribe_failed");
      const data = (await res.json()) as { transcript?: string };
      sttTranscript = (data.transcript ?? "").trim();
      if (!sttTranscript) throw new Error("empty_transcript");
      setTranscript(sttTranscript);
    } catch {
      setVoiceState("error");
      return;
    }

    try {
      await streamAnswer(sttTranscript);
      setVoiceState("response");
    } catch (err) {
      // Abort means the user dismissed mid-stream — leave state as-is.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setVoiceState("error");
    }
  }, [streamAnswer]);

  const askWithText = useCallback(
    async (clauseId: string, question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      setActiveClauseId(clauseId);
      setTranscript(trimmed);
      setAnswer("");
      setVoiceState("processing");

      try {
        await streamAnswer(trimmed);
        setVoiceState("response");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setVoiceState("error");
      }
    },
    [streamAnswer],
  );

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
    answerAbortRef.current?.abort();
    answerAbortRef.current = null;
    setActiveClauseId(null);
    setVoiceState("idle");
  }, []);

  const dismiss = useCallback(() => {
    answerAbortRef.current?.abort();
    answerAbortRef.current = null;
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
    askWithText,
    cancel,
    dismiss,
  };
}
