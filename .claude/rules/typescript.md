# TypeScript rules

- `strict: true`. No `any`, no non-null assertions without an inline reason.
- Prefer `unknown` + narrowing over `any`.
- All exported functions typed at boundaries. Infer internally.
- Immutability: new objects, no in-place mutation. Use `readonly` on public data shapes.
- `zod` (or equivalent) for runtime validation at API boundaries.
- Errors: throw `Error` subclasses with a discriminated `name`. Never throw strings.
- Small files (200–400 lines typical, 800 max). Feature-based folders under `src/`.
- Public API first: decide the type, then the implementation.
