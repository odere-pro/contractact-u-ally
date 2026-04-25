// Shim used by Vitest to bypass the `server-only` import guard, which
// otherwise throws when route handlers are imported outside the Next.js
// runtime. Vitest aliases the bare specifier to this file.
export {};
