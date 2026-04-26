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

// Only Dutch (nl) is shipped today. The schema in `./schemas.ts` rejects
// any other value, which would otherwise surface as ENOENT when the rule
// loader tries to read a non-existent `data/<jurisdiction>-labor-law.json`.
const SYSTEM_PROMPT = `You are a contract type classifier. Match the given contract text to the closest type from the list.

Respond with EXACTLY ONE JSON object and nothing else — no markdown, no explanation, no code fences:
{"typeId":"<id from the list>","confidence":<0.0–1.0>,"jurisdiction":"nl"}

Rules:
- Pick the single best matching typeId.
- confidence: 0.0 = random guess, 1.0 = certain match.
- jurisdiction: always "nl" (Dutch labour law is the only ruleset currently supported).
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
