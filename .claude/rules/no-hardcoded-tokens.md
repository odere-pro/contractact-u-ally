# Rule: no hardcoded colors or fonts in components

Files under `src/components/**` MUST NOT contain hardcoded color values (hex, rgb, hsl, named colors) or font families. Reference design tokens defined in `src/app/globals.css` under `@theme` (Tailwind v4 idiom) — either via the generated Tailwind utility or via `var(--token)`.

## Violations (fail review)

```tsx
// ❌ hex
<div style={{ color: "#0F172A" }} />

// ❌ rgb / hsl
<div style={{ background: "rgb(15, 23, 42)" }} />

// ❌ Tailwind arbitrary with hex
<div className="text-[#0F172A]" />

// ❌ font-family
<p style={{ fontFamily: "Inter, sans-serif" }} />
```

## Correct

```tsx
// ✅ token via CSS var
<div style={{ color: "var(--color-foreground)" }} />

// ✅ Tailwind utility generated from @theme
<div className="bg-primary text-primary-foreground" />

// ✅ Tailwind arbitrary referencing a var
<div className="border-[var(--color-border)]" />

// ✅ inherit from parent / default styles
<p>Text</p>
```

## Where tokens live

Tailwind v4 reads theme tokens from `@theme { ... }` directives inside `src/app/globals.css`. Add new colors / spacing / radii / fonts there. Do NOT create a `tailwind.config.ts` for tokens — see `docs/gotchas.md` ("Tailwind v4 uses CSS config").

## Exceptions

- `src/app/globals.css` (the `@theme` block itself) — only file allowed to declare hex.
- `public/icons/*.svg` and other static assets — source-level, not components.
- `tests/**` and `*.test.{ts,tsx}` — fixtures and snapshots may use any color.

## Enforcement

Currently review-time only (Claude + reviewer). A custom ESLint rule could enforce this in CI later — out of scope for now.
