// FE-only "reading lens" applied to result copy. The BE returns one
// canonical explanation; the FE picks tone & framing per audience.
// This stays client-side until BE supports per-profile prompting.

export const PROFILES = ["migrant_worker", "student", "senior_pro", "legal_counsel"] as const;
export type Profile = (typeof PROFILES)[number];
export const DEFAULT_PROFILE: Profile = "migrant_worker";

export function isProfile(value: unknown): value is Profile {
  return typeof value === "string" && (PROFILES as readonly string[]).includes(value);
}

export const PROFILE_LABEL: Record<Profile, string> = {
  migrant_worker: "Migrant Worker",
  student: "Student",
  senior_pro: "Senior Pro",
  legal_counsel: "Legal Counsel",
};

export const PROFILE_TAGLINE: Record<Profile, string> = {
  migrant_worker: "Plain-language explanation, focused on what to do next and who can help.",
  student: "Short, friendly summary with examples relevant to part-time and entry-level work.",
  senior_pro: "Concise, business-toned summary with negotiation leverage where it matters.",
  legal_counsel: "Statute citations first; minimum interpretation, maximum traceability.",
};

// Whether a given profile prefers the "do not sign" CTA + legal-aid
// banner on critical findings. Legal counsel is assumed to handle
// triage themselves, so we suppress the HITL escalation.
export function showsLegalAidEscalation(profile: Profile): boolean {
  return profile !== "legal_counsel";
}
