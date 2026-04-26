import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROFILE,
  PROFILES,
  PROFILE_LABEL,
  isProfile,
  showsLegalAidEscalation,
} from "@/lib/profileCopy";

describe("profileCopy", () => {
  it("DEFAULT_PROFILE is a valid profile", () => {
    expect(isProfile(DEFAULT_PROFILE)).toBe(true);
  });

  it("isProfile rejects unknown strings and non-strings", () => {
    expect(isProfile("legal_counsel")).toBe(true);
    expect(isProfile("ceo")).toBe(false);
    expect(isProfile(undefined)).toBe(false);
    expect(isProfile(42)).toBe(false);
  });

  it("every profile has a human label", () => {
    for (const p of PROFILES) {
      expect(PROFILE_LABEL[p]).toBeTruthy();
    }
  });

  it("legal_counsel suppresses the HITL escalation; others show it", () => {
    expect(showsLegalAidEscalation("legal_counsel")).toBe(false);
    expect(showsLegalAidEscalation("migrant_worker")).toBe(true);
    expect(showsLegalAidEscalation("student")).toBe(true);
    expect(showsLegalAidEscalation("senior_pro")).toBe(true);
  });
});
