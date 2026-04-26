// Single source of truth for the DOM id used to anchor a clause's
// inline highlight. The encoding contract: percent-encode the clause
// id (which can contain `§`, spaces, slashes, etc.) and prefix with
// `clause-`. Consumers using the result in a CSS selector must wrap
// it with `CSS.escape()`; for `getElementById` no escape is needed.
export function clauseMarkId(id: string): string {
  return `clause-${encodeURIComponent(id)}`;
}
