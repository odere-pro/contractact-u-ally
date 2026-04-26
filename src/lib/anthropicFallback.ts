import "server-only";

import type { ClauseEvent, SummaryEvent } from "@/lib/catalog/types";

// Detect Anthropic billing/credit/quota failures so the pipeline can
// degrade to mocked data instead of returning a hard error to the UI.
// Matches the SDK's `BadRequestError` ("credit balance is too low") plus
// the broader family of quota/billing 4xx responses.
export function isAnthropicCreditError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const status = (err as { status?: unknown }).status;
  const message = (err as { message?: unknown }).message;
  const messageText = typeof message === "string" ? message.toLowerCase() : "";

  const looksLikeCreditMessage =
    messageText.includes("credit balance is too low") ||
    messageText.includes("insufficient_quota") ||
    messageText.includes("quota") ||
    messageText.includes("billing");

  if (looksLikeCreditMessage) return true;

  // Some SDK shapes nest the provider error under `error.error.message`.
  const nested = (err as { error?: { error?: { message?: unknown } } }).error?.error?.message;
  if (typeof nested === "string") {
    const nestedText = nested.toLowerCase();
    if (
      nestedText.includes("credit balance is too low") ||
      nestedText.includes("insufficient_quota") ||
      nestedText.includes("quota") ||
      nestedText.includes("billing")
    ) {
      return true;
    }
  }

  // Fall back to status-based hints. 402 is the canonical "Payment Required".
  return status === 402;
}

// Fixed mock clauses + summary so the UI keeps rendering when Claude is
// unreachable (no credits, no key, transient outage). Realistic enough to
// exercise illegal / exploitative / compliant rendering paths.
const MOCK_CLAUSES: readonly ClauseEvent[] = [
  {
    type: "clause",
    id: "mock-trial-period",
    title: "Trial period (proeftijd)",
    status: "illegal",
    originalText: "The employee will serve a trial period of six (6) months from the start date.",
    explanation:
      "Dutch law caps the trial period at two months for an indefinite-term contract. A six-month proeftijd is void by operation of law — the trial period simply does not apply.",
    citation: {
      article: "BW 7:652",
      label: "Trial period cap",
      source: "nl-labor-law.json",
    },
    action:
      "Treat the trial period as absent. The employer cannot terminate without notice on this basis.",
    permitConflict: null,
    riskMappings: [{ risk: "red", path: "trial-period", category: "contract-terms" }],
  },
  {
    type: "clause",
    id: "mock-non-compete",
    title: "Non-compete clause",
    status: "exploitative",
    originalText:
      "Employee shall not work for any competitor within the EU for two years after termination.",
    explanation:
      "A two-year EU-wide non-compete is unusually broad and likely unenforceable in court. Dutch courts routinely narrow scope and duration; insist on written justification of compelling business interest.",
    citation: {
      article: "BW 7:653",
      label: "Non-compete clause must be in writing",
      source: "nl-labor-law.json",
    },
    action:
      "Ask the employer to narrow the scope (geography + duration) and document the business interest in writing.",
    permitConflict: null,
    riskMappings: [{ risk: "amber", path: "non-compete", category: "post-termination" }],
  },
  {
    type: "clause",
    id: "mock-salary",
    title: "Gross monthly salary",
    status: "compliant",
    originalText: "Gross monthly salary: EUR 3,200, paid on the 25th of each month.",
    explanation:
      "Salary is stated in EUR with a clear payment date. This satisfies the mandatory disclosure for a Dutch employment contract.",
    citation: null,
    action: null,
    permitConflict: null,
    riskMappings: [{ risk: "green", path: "salary", category: "mandatory" }],
  },
  {
    type: "clause",
    id: "mock-working-hours",
    title: "Working hours",
    status: "compliant",
    originalText: "Standard working week: 40 hours, Monday through Friday.",
    explanation: "Working hours are clearly stated and within the legal weekly maximum.",
    citation: null,
    action: null,
    permitConflict: null,
    riskMappings: [{ risk: "green", path: "working-hours", category: "mandatory" }],
  },
  {
    type: "clause",
    id: "mock-notice-period",
    title: "Notice period",
    status: "compliant",
    originalText: "Either party may terminate this contract with one (1) month's written notice.",
    explanation:
      "A one-month notice period meets the statutory minimum for an indefinite-term contract in the first five years of service.",
    citation: null,
    action: null,
    permitConflict: null,
    riskMappings: [{ risk: "green", path: "notice-period", category: "mandatory" }],
  },
];

const MOCK_SUMMARY: SummaryEvent = {
  type: "summary",
  jurisdiction: "nl",
  contractType: "Dutch indefinite-term employment contract",
  detectedLanguage: "en",
  totalClauses: MOCK_CLAUSES.length,
  illegalCount: 1,
  exploitativeCount: 1,
  permitConflictCount: 0,
  uncheckedCount: 0,
  compliantCount: 3,
};

/**
 * NDJSON lines (with trailing "\n") for the analyze stage when Anthropic
 * is unreachable. The first line is an `ocr_text` replacement so the
 * client swaps the real OCR'd contract for the synthetic one whose text
 * contains every mock clause's snippet verbatim — without that swap,
 * the contract pane has no `<mark>` to scroll a card click toward when
 * mock kicks in mid-stream (e.g. credit exhausted with a real OCR
 * already on screen).
 */
export function mockAnalyzeNdjsonLines(): readonly string[] {
  const ocr = mockOcrResult();
  const ocrLine = JSON.stringify({ type: "ocr_text", text: ocr.text, pages: ocr.pages }) + "\n";
  return [
    ocrLine,
    ...MOCK_CLAUSES.map((c) => JSON.stringify(c) + "\n"),
    JSON.stringify(MOCK_SUMMARY) + "\n",
  ];
}

// Synthetic OCR text used in mock-only mode. Must contain every mock
// clause's `originalText` verbatim so `splitWithHighlights` produces a
// `<mark>` for each card — without that, clicking a clause card has no
// scroll target in the contract preview.
const MOCK_OCR_TEXT = [
  "EMPLOYMENT CONTRACT",
  "Indefinite-term, governed by Dutch labour law.",
  "",
  "1. Trial period",
  "The employee will serve a trial period of six (6) months from the start date.",
  "",
  "2. Compensation",
  "Gross monthly salary: EUR 3,200, paid on the 25th of each month.",
  "",
  "3. Working hours",
  "Standard working week: 40 hours, Monday through Friday.",
  "",
  "4. Notice period",
  "Either party may terminate this contract with one (1) month's written notice.",
  "",
  "5. Non-compete",
  "Employee shall not work for any competitor within the EU for two years after termination.",
  "",
  "Signed in duplicate. Each party retains an executed counterpart.",
].join("\n");

/**
 * True when there's no Anthropic API key configured, meaning the analyze
 * stage will fall back to mock NDJSON anyway. The pre-flight check lets
 * the pipeline skip real OCR and substitute a synthetic contract whose
 * text contains the mock clause snippets verbatim, so clause-card →
 * contract-pane scroll/highlight still works in mock mode.
 */
export function isMockOnlyMode(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !key || key.trim() === "";
}

export interface MockOcrResult {
  readonly text: string;
  readonly pages: number;
}

export function mockOcrResult(): MockOcrResult {
  return { text: MOCK_OCR_TEXT, pages: 1 };
}
