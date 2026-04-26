import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useProfile } from "@/hooks/useProfile";

const STORAGE_KEY = "contractact.profile";

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

describe("useProfile", () => {
  it("hydrates to the default profile on first visit", async () => {
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.profile).toBe("migrant_worker");
  });

  it("setProfile() persists the value and updates state", async () => {
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.setProfile("legal_counsel"));

    expect(result.current.profile).toBe("legal_counsel");
    expect(store.get(STORAGE_KEY)).toBe("legal_counsel");
  });

  it("rehydrates a previously-stored valid profile", async () => {
    store.set(STORAGE_KEY, "student");
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.profile).toBe("student");
  });

  it("ignores garbage in storage and falls back to the default", async () => {
    store.set(STORAGE_KEY, "ceo");
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.profile).toBe("migrant_worker");
  });
});
