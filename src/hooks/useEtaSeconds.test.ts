import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEtaSeconds, type EtaInputs } from "@/hooks/useEtaSeconds";

const T0 = 1_700_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

function inputs(overrides: Partial<EtaInputs> = {}): EtaInputs {
  return {
    startedAt: T0,
    isWorking: true,
    stage: "ocr",
    stageProgress: 0.5,
    ...overrides,
  };
}

describe("useEtaSeconds", () => {
  it("returns null when not working", () => {
    const { result } = renderHook(() => useEtaSeconds(inputs({ isWorking: false })));
    expect(result.current).toBeNull();
  });

  it("returns null when startedAt is null", () => {
    const { result } = renderHook(() => useEtaSeconds(inputs({ startedAt: null })));
    expect(result.current).toBeNull();
  });

  it("returns null before MIN_ELAPSED_MS_FOR_ETA has passed", () => {
    const { result } = renderHook(() => useEtaSeconds(inputs()));
    // < 750ms elapsed → null
    expect(result.current).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBeNull();
  });

  it("returns a number after the elapsed threshold matching the projected remaining time", () => {
    const { result } = renderHook(() =>
      useEtaSeconds(inputs({ stage: "ocr", stageProgress: 0.5 })),
    );
    // overall = (0 + 0.5) / 4 = 0.125 → totalMs = elapsed / 0.125 = 8 * elapsed
    // At 1000ms elapsed → projected total 8000ms → 7000ms remaining.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(7);
  });

  it("decreases when reported progress advances", () => {
    const { result, rerender } = renderHook((p: EtaInputs) => useEtaSeconds(p), {
      initialProps: inputs({ stage: "ocr", stageProgress: 0.5 }),
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const before = result.current;
    expect(before).not.toBeNull();

    // Server reported progress jumped forward → projected total shrinks.
    rerender(inputs({ stage: "analyze", stageProgress: 0.5 }));
    expect(result.current).not.toBeNull();
    expect(result.current!).toBeLessThan(before!);
  });

  it("returns null when overall progress is at or beyond 1", () => {
    const { result } = renderHook(() =>
      useEtaSeconds(inputs({ stage: "analyze", stageProgress: 1 })),
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeNull();
  });

  it("clamps stageProgress out of [0,1]", () => {
    const { result } = renderHook(() =>
      useEtaSeconds(inputs({ stage: "ocr", stageProgress: -0.5 })),
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // overall = 0 → null per the <= 0 guard
    expect(result.current).toBeNull();
  });
});
