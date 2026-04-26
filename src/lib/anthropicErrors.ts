import "server-only";

// Detect Anthropic billing/credit/quota failures so callers can surface a
// specific error to the UI instead of a generic 5xx. Matches the SDK's
// `BadRequestError` ("credit balance is too low") plus the broader family
// of quota/billing 4xx responses.
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

// Detect missing / invalid API key failures so callers can surface the same
// "translation unavailable" copy as credit exhaustion. Without this, an
// unset ANTHROPIC_API_KEY (or a rotated key) is treated as a generic
// provider crash and leaks 502s into the UI.
export function isAnthropicAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const status = (err as { status?: unknown }).status;
  if (status === 401) return true;

  const message = (err as { message?: unknown }).message;
  const messageText = typeof message === "string" ? message.toLowerCase() : "";
  const looksLikeAuthMessage =
    messageText.includes("authentication") ||
    messageText.includes("invalid x-api-key") ||
    messageText.includes("api_key") ||
    messageText.includes("api key") ||
    messageText.includes("could not resolve authentication");

  if (looksLikeAuthMessage) return true;

  // SDK sometimes nests the provider error under `error.error.message`.
  const nested = (err as { error?: { error?: { message?: unknown } } }).error?.error?.message;
  if (typeof nested === "string") {
    const nestedText = nested.toLowerCase();
    if (
      nestedText.includes("authentication") ||
      nestedText.includes("invalid x-api-key") ||
      nestedText.includes("api_key") ||
      nestedText.includes("api key")
    ) {
      return true;
    }
  }

  return false;
}
