"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_PROFILE, isProfile, type Profile } from "@/lib/profileCopy";

const STORAGE_KEY = "contractact.profile";

interface UseProfileResult {
  readonly profile: Profile;
  readonly hydrated: boolean;
  readonly setProfile: (next: Profile) => void;
}

// Active "reading lens" — tone & framing of result copy. Persisted so
// repeat visitors don't have to re-pick. Only ever stores the enum
// string, never any document data.
export function useProfile(): UseProfileResult {
  const [profile, setProfileState] = useState<Profile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isProfile(stored)) setProfileState(stored);
    } catch {
      /* no-op */
    } finally {
      setHydrated(true);
    }
  }, []);

  const setProfile = useCallback((next: Profile): void => {
    setProfileState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* no-op */
    }
  }, []);

  return { profile, hydrated, setProfile };
}
