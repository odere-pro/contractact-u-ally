import "server-only";

import { getAnthropic } from "@/lib/anthropicClient";
import { listContractTypes } from "./ruleLoader";
import { classifyResponseSchema } from "./schemas";
import type { ClassifyResult, ContractTypeEntry, Jurisdiction } from "./types";

const CLASSIFY_MODEL = "claude-sonnet-4-6";

function buildUserMessage(
  text: string,
  types: readonly ContractTypeEntry[],
  jurisdiction?: Jurisdiction,
): string {
  const filtered = types.filter((t) => !jurisdiction || t.jurisdiction === jurisdiction);
  const typesBlock = filtered.map((t) => `- ${t.id}: ${t.title} (${t.jurisdiction})`).join("\n");
  return `Available contract types:\n${typesBlock}\n\nContract to classify (first 2000 characters):\n"""\n${text.slice(
    0,
    2000,
  )}\n"""`;
}

const SYSTEM_PROMPT = `You are a contract type classifier. Match the given contract text to the closest type from the list.

Respond with EXACTLY ONE JSON object and nothing else — no markdown, no explanation, no code fences:
{"typeId":"<id from the list>","confidence":<0.0–1.0>,"jurisdiction":"<nl or se>"}

Rules:
- Pick the single best matching typeId.
- confidence: 0.0 = random guess, 1.0 = certain match.
- jurisdiction: "nl" if Dutch, "se" if Swedish. Default "nl" if unclear.
- If none match well, pick the closest and set confidence < 0.5.`;

const FALLBACK = (jurisdiction: Jurisdiction | undefined): ClassifyResult => ({
  typeId: "nl-indefinite",
  confidence: 0,
  jurisdiction: jurisdiction ?? "nl",
});

export async function classifyContract(
  text: string,
  jurisdiction?: Jurisdiction,
): Promise<ClassifyResult> {
  const types = await listContractTypes();
  if (types.length === 0) return FALLBACK(jurisdiction);

  const message = await getAnthropic().messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 128,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(text, types, jurisdiction) }],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return FALLBACK(jurisdiction);

  try {
    const parsed = classifyResponseSchema.safeParse(JSON.parse(jsonMatch[0]));
    return parsed.success ? parsed.data : FALLBACK(jurisdiction);
  } catch {
    return FALLBACK(jurisdiction);
  }
}
