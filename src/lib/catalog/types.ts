// Domain types for the contract risk pipeline. Public surface — every
// server module + the analyze stream consumer imports from here.
// Pure types, no runtime deps; safe to import from client code.

export type Jurisdiction = "nl" | "se";

export const SUPPORTED_LANGUAGES = [
  "en",
  "nl",
  "sv",
  "uk",
  "ru",
  "ar",
  "tr",
  "es",
  "pt",
  "pl",
  "de",
  "fr",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export type ClauseStatus =
  | "illegal"
  | "exploitative"
  | "compliant"
  | "permit_conflict"
  | "unchecked";

export type RiskLevel = "red" | "amber" | "green";

export interface Citation {
  readonly article: string;
  readonly label: string;
  readonly source: string;
}

export interface PermitConflict {
  readonly permitType: string;
  readonly reason: string;
}

export interface RiskMapping {
  readonly risk: RiskLevel;
  readonly path: string;
  readonly category: string;
}

// --- Ruleset shapes (data/{jurisdiction}-labor-law.json) ---

export interface Rule {
  readonly id: string;
  readonly article: string;
  readonly label: string;
  readonly category?: string;
  readonly summary: string;
  readonly tags: readonly string[];
}

export interface Ruleset {
  readonly jurisdiction: Jurisdiction;
  readonly source: string;
  readonly rules: readonly Rule[];
}

// --- Contract-type spec (data/contract-types/<id>.json) ---

export interface MandatoryClause {
  readonly id: string;
  readonly description: string;
}

export interface RedFlagClause {
  readonly id: string;
  readonly severity: string;
  readonly riskLevel: RiskLevel;
  readonly category: string;
  readonly heading: string;
  readonly plain_english: string;
  readonly action: string;
}

export interface ContractTypeSpec {
  readonly id: string;
  readonly title: string;
  readonly jurisdiction: Jurisdiction;
  readonly applicable_rule_ids: readonly string[];
  readonly mandatory_clauses: readonly MandatoryClause[];
  readonly red_flag_ids: readonly string[];
}

export interface ContractTypeEntry {
  readonly id: string;
  readonly title: string;
  readonly jurisdiction: Jurisdiction;
}

export interface LoadedRuleSet {
  readonly contractType: string;
  readonly contractTypeTitle: string;
  readonly applicableRules: readonly Rule[];
  readonly mandatoryClauses: readonly MandatoryClause[];
  readonly redFlags: readonly RedFlagClause[];
}

export interface ClassifyResult {
  readonly typeId: string;
  readonly confidence: number;
  readonly jurisdiction: Jurisdiction;
}

// --- NDJSON events emitted by /api/analyze ---

export type AnalyzeStage = "classify" | "load_rules" | "analyze";

export interface StageEvent {
  readonly type: "stage";
  readonly stage: AnalyzeStage;
  readonly progress: number;
}

export interface ClauseEvent {
  readonly type: "clause";
  readonly id: string;
  readonly title: string;
  readonly status: ClauseStatus;
  readonly originalText: string;
  readonly explanation: string;
  readonly citation: Citation | null;
  readonly action: string | null;
  readonly permitConflict: PermitConflict | null;
  readonly riskMappings?: readonly RiskMapping[];
}

export interface SummaryEvent {
  readonly type: "summary";
  readonly jurisdiction: Jurisdiction;
  readonly contractType: string;
  readonly detectedLanguage: SupportedLanguage;
  readonly totalClauses: number;
  readonly illegalCount: number;
  readonly exploitativeCount: number;
  readonly permitConflictCount: number;
  readonly uncheckedCount: number;
  readonly compliantCount: number;
}

export interface ErrorEvent {
  readonly type: "error";
  readonly message: string;
}

export type AnalyzeEvent = StageEvent | ClauseEvent | SummaryEvent | ErrorEvent;
