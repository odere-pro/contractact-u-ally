import "server-only";

// Shared JSON response helpers so every route handler returns the same
// envelope. Errors are always `{ error: string }`; success payloads keep
// their declared shape so route-level types stay precise.

export interface ApiErrorBody {
  readonly error: string;
}

export function jsonError(status: number, message: string): Response {
  const body: ApiErrorBody = { error: message };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk<T>(payload: T): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
