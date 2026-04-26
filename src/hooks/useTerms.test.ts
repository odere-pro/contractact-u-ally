import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useTerms } from "@/hooks/useTerms";

const STORAGE_KEY = "contractact.termsAcceptedAt";

function installMemoryStorage(): Map<string, string> {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      get length() {
        return store.size;
      },
    } satisfies Storage,
  });
  return store;
}

let store: Map<string, string>;

beforeEach(() => {
  store = installMemoryStorage();
});

afterEach(() => {
  store.clear();
});

describe("useTerms", () => {
  it("hydrates to not-accepted on first load", async () => {
    const { result } = renderHook(() => useTerms());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.accepted).toBe(false);
  });

  it("accept() persists an ISO timestamp and flips state", async () => {
    const { result } = renderHook(() => useTerms());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.accept());

    expect(result.current.accepted).toBe(true);
    expect(store.get(STORAGE_KEY)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rehydrates as accepted when storage already holds a timestamp", async () => {
    store.set(STORAGE_KEY, "2026-01-01T00:00:00.000Z");
    const { result } = renderHook(() => useTerms());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.accepted).toBe(true);
  });

  it("revoke() clears storage and flips back to not-accepted", async () => {
    store.set(STORAGE_KEY, "2026-01-01T00:00:00.000Z");
    const { result } = renderHook(() => useTerms());
    await waitFor(() => expect(result.current.accepted).toBe(true));

    act(() => result.current.revoke());

    expect(result.current.accepted).toBe(false);
    expect(store.has(STORAGE_KEY)).toBe(false);
  });
});
