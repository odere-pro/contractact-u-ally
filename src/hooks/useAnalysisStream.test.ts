import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAnalysisStream } from "./useAnalysisStream";

function ndjsonStream(lines: readonly string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

describe("useAnalysisStream", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("transitions phase idle → running → done and accumulates clauses in stream order", async () => {
    const lines = [
      JSON.stringify({ type: "stage", stage: "classify", progress: 0 }),
      JSON.stringify({ type: "stage", stage: "analyze", progress: 0 }),
      JSON.stringify({
        type: "clause",
        id: "c-1",
        title: "Probation",
        status: "illegal",
        originalText: "...",
        explanation: "...",
        citation: null,
        action: null,
        permitConflict: null,
      }),
      JSON.stringify({
        type: "summary",
        jurisdiction: "nl",
        contractType: "nl-indefinite",
        detectedLanguage: "en",
        totalClauses: 1,
        illegalCount: 1,
        exploitativeCount: 0,
        permitConflictCount: 0,
        uncheckedCount: 0,
        compliantCount: 0,
      }),
    ];
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(ndjsonStream(lines));

    const { result } = renderHook(() => useAnalysisStream());
    expect(result.current.state.phase).toBe("idle");

    await act(async () => {
      await result.current.run({ ocrText: "x".repeat(300) });
    });

    expect(result.current.state.phase).toBe("done");
    expect(result.current.state.clauses).toHaveLength(1);
    expect(result.current.state.clauses[0]?.id).toBe("c-1");
    expect(result.current.state.summary?.totalClauses).toBe(1);
  });

  it("an error event clears stage and stageProgress so the tracker can't show stale state", async () => {
    const lines = [
      JSON.stringify({ type: "stage", stage: "analyze", progress: 0.42 }),
      JSON.stringify({ type: "error", message: "model failure" }),
    ];
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(ndjsonStream(lines));

    const { result } = renderHook(() => useAnalysisStream());
    await act(async () => {
      await result.current.run({ ocrText: "y".repeat(300) });
    });

    expect(result.current.state.phase).toBe("error");
    expect(result.current.state.error).toBe("model failure");
    expect(result.current.state.stage).toBeNull();
    expect(result.current.state.stageProgress).toBe(0);
  });

  it("silently drops malformed JSON and lines that fail schema validation", async () => {
    const lines = [
      "{not json",
      JSON.stringify({ type: "unknown_event_kind", foo: 1 }),
      JSON.stringify({
        type: "summary",
        jurisdiction: "nl",
        contractType: "nl-indefinite",
        detectedLanguage: "en",
        totalClauses: 0,
        illegalCount: 0,
        exploitativeCount: 0,
        permitConflictCount: 0,
        uncheckedCount: 0,
        compliantCount: 0,
      }),
    ];
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(ndjsonStream(lines));

    const { result } = renderHook(() => useAnalysisStream());
    await act(async () => {
      await result.current.run({ ocrText: "z".repeat(300) });
    });

    expect(result.current.state.phase).toBe("done");
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.summary?.totalClauses).toBe(0);
  });

  it("reset() aborts an in-flight fetch and returns state to idle", async () => {
    let abortSeen = false;
    vi.mocked(globalThis.fetch).mockImplementationOnce(async (_url, init) => {
      const signal = (init as RequestInit | undefined)?.signal;
      // Resolve only once aborted, mimicking a stream that's still pending.
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          abortSeen = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });

    const { result } = renderHook(() => useAnalysisStream());

    act(() => {
      void result.current.run({ ocrText: "k".repeat(300) });
    });
    await waitFor(() => expect(result.current.state.phase).toBe("running"));

    act(() => {
      result.current.reset();
    });

    await waitFor(() => expect(abortSeen).toBe(true));
    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.clauses).toEqual([]);
  });

  it("surfaces transport errors via state.error without crashing", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError("network down"));

    const { result } = renderHook(() => useAnalysisStream());
    await act(async () => {
      await result.current.run({ ocrText: "q".repeat(300) });
    });

    expect(result.current.state.phase).toBe("error");
    expect(result.current.state.error).toBe("network down");
  });
});
