import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// One client per process. The SDK reads ANTHROPIC_API_KEY implicitly.
let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!cached) cached = new Anthropic();
  return cached;
}

/** Test helper — drops the cached client. */
export function __resetAnthropicClientForTests(): void {
  cached = null;
}
