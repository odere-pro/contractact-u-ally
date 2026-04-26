import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "./types";

// Single supported jurisdiction today — `z.literal` produces a clearer error
// message ("Expected literal nl") than a single-element `z.enum` and matches
// the narrowed `Jurisdiction` type in `./types.ts`.
export const jurisdictionSchema = z.literal("nl");

export const supportedLanguageSchema = z.enum(SUPPORTED_LANGUAGES);

export const clauseStatusSchema = z.enum([
  "illegal",
  "exploitative",
  "compliant",
  "permit_conflict",
  "unchecked",
]);

export const riskLevelSchema = z.enum(["red", "amber", "green"]);

export const riskMappingSchema = z.object({
  risk: riskLevelSchema,
  path: z.string().min(1),
  category: z.string().min(1),
});

export const citationSchema = z.object({
  article: z.string().min(1),
  label: z.string().min(1),
  source: z.string().min(1),
});

export const permitConflictSchema = z.object({
  permitType: z.string().min(1),
  reason: z.string().min(1),
});

export const ruleSchema = z.object({
  id: z.string().min(1),
  article: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1).optional(),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)),
});

export const rulesetSchema = z.object({
  jurisdiction: jurisdictionSchema,
  source: z.string().min(1),
  rules: z.array(ruleSchema).min(1),
});

export const mandatoryClauseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
});

export const redFlagClauseSchema = z.object({
  id: z.string().min(1),
  severity: z.string().min(1),
  riskLevel: riskLevelSchema,
  category: z.string().min(1),
  heading: z.string().min(1),
  plain_english: z.string().min(1),
  action: z.string().min(1),
});

export const contractTypeSpecSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  jurisdiction: jurisdictionSchema,
  applicable_rule_ids: z.array(z.string().min(1)),
  mandatory_clauses: z.array(mandatoryClauseSchema),
  red_flag_ids: z.array(z.string()),
});

export const contractTypeEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  jurisdiction: jurisdictionSchema,
});

export const classifyResponseSchema = z.object({
  typeId: z.string().min(1),
  confidence: z.number().min(0).max(1),
  jurisdiction: jurisdictionSchema,
});
export type ClassifyResponse = z.infer<typeof classifyResponseSchema>;

// --- NDJSON events ---

export const stageEventSchema = z.object({
  type: z.literal("stage"),
  stage: z.enum(["ocr", "classify", "load_rules", "analyze"]),
  progress: z.number().min(0).max(1),
});

export const clauseEventSchema = z.object({
  type: z.literal("clause"),
  id: z.string().min(1),
  title: z.string().min(1),
  status: clauseStatusSchema,
  originalText: z.string(),
  explanation: z.string(),
  citation: citationSchema.nullable(),
  action: z.string().nullable(),
  permitConflict: permitConflictSchema.nullable(),
  riskMappings: z.array(riskMappingSchema).optional().default([]),
});

export const summaryEventSchema = z.object({
  type: z.literal("summary"),
  jurisdiction: jurisdictionSchema,
  contractType: z.string().min(1),
  detectedLanguage: supportedLanguageSchema,
  totalClauses: z.number().int().nonnegative(),
  illegalCount: z.number().int().nonnegative(),
  exploitativeCount: z.number().int().nonnegative(),
  permitConflictCount: z.number().int().nonnegative(),
  uncheckedCount: z.number().int().nonnegative(),
  compliantCount: z.number().int().nonnegative(),
});

// Emitted once, right after `stage ocr (progress: 1)` — gives the client
// the extracted text so it can render the highlighted contract preview
// without a second round trip.
export const ocrTextEventSchema = z.object({
  type: z.literal("ocr_text"),
  text: z.string().min(1),
  pages: z.number().int().nonnegative(),
});

export const errorEventSchema = z.object({
  type: z.literal("error"),
  message: z.string().min(1),
});

// --- /api/analyze request ---

// Server-side guard against pathological OCR output. The PDF itself is
// already capped at 10 MB by upload validation; this protects the prompt
// builder from a malicious provider response that would otherwise blow
// past the model context.
export const MAX_CONTRACT_BYTES = 500 * 1024;

// typeId is interpolated into a filesystem path by ruleLoader.loadSpec, so
// it must be locked to a strict allowlist shape — anything outside this
// pattern can attempt traversal (../etc/passwd) or load arbitrary catalog
// files. Real ids look like "nl-indefinite", "se-fixed-term", etc.
export const TYPE_ID_PATTERN = /^[a-z]{2}-[a-z0-9-]+$/;

export const typeIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(TYPE_ID_PATTERN, "typeId must match /^[a-z]{2}-[a-z0-9-]+$/");

// Optional form fields that ride alongside the PDF on /api/analyze.
export const analyzeFormFieldsSchema = z.object({
  jurisdiction: jurisdictionSchema.optional(),
  typeId: typeIdSchema.optional(),
});
export type AnalyzeFormFields = z.infer<typeof analyzeFormFieldsSchema>;
