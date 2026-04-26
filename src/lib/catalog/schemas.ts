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
  stage: z.enum(["classify", "load_rules", "analyze"]),
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

export const errorEventSchema = z.object({
  type: z.literal("error"),
  message: z.string().min(1),
});

// --- /api/analyze request ---

// 500 KB cap on OCR text; UTF-8 byte-aware so we don't trip on multi-byte chars.
export const MAX_CONTRACT_BYTES = 500 * 1024;
const utf8ByteLength = (s: string): number => new TextEncoder().encode(s).byteLength;

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

export const analyzeRequestSchema = z.object({
  ocrText: z
    .string()
    .min(200, "ocrText too short — likely an OCR failure")
    .refine((s) => utf8ByteLength(s) <= MAX_CONTRACT_BYTES, {
      message: "ocrText exceeds 500KB",
    }),
  jurisdiction: jurisdictionSchema.optional(),
  typeId: typeIdSchema.optional(),
});
export type AnalyzeRequestInput = z.infer<typeof analyzeRequestSchema>;
