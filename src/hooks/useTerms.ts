"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "contractact.termsAcceptedAt";

interface UseTermsResult {
  readonly accepted: boolean;
  readonly hydrated: boolean;
  readonly accept: () => void;
  readonly revoke: () => void;
}

// Local-only T&C gate. We only persist the ISO timestamp of the last
// acceptance — never any document content. The timestamp lets a future
// change to the terms text invalidate the gate by comparing dates.
export function useTerms(): UseTermsResult {
  const [accepted, setAccepted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      setAccepted(typeof stored === "string" && stored.length > 0);
    } catch {
      // Private mode / disabled storage — treat as not-accepted but
      // still hydrate so the gate renders predictably.
    } finally {
      setHydrated(true);
    }
  }, []);

  const accept = useCallback((): void => {
    const stamp = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, stamp);
    } catch {
      // Storage unavailable — accept for the session anyway.
    }
    setAccepted(true);
  }, []);

  const revoke = useCallback((): void => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* no-op */
    }
    setAccepted(false);
  }, []);

  return { accepted, hydrated, accept, revoke };
}
