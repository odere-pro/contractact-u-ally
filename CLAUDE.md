# contractact-u-ally

> A worker uploads their employment contract and gets a plain-language report
> in their own language within 60 seconds — every illegal clause flagged
> against the exact Dutch law it violates (Swedish jurisdiction planned, not
> yet shipped), with clear next steps.

**Tagline:** _"Know what you signed."_

## Status

Setup-only scaffold. The landing page uploads a PDF to a stub OCR endpoint
(`/api/ocr`) that returns placeholder text. Domain logic (rule loading,
clause analysis, citation validation, results UI) is intentionally absent
and lives on feature branches.

## Architecture

Next.js 16 App Router + React 19 + Tailwind v4 + shadcn/ui. API routes at
`src/app/api/*` will stream via the Anthropic SDK once domain logic returns.
Vercel deployment. No database planned — client-side `localStorage` summary
only, never the full contract.

## Default routing

For any task touching code, tests, or config, FIRST invoke the
`full-stack-developer` agent to get a routing plan. Skip only for read-only
questions and one-line edits.

## Working playbook

The `docs/guides/` directory is the source of truth for how we work in this
repo. Read the relevant guide before starting a task:

| Guide                                 | When                                            |
| ------------------------------------- | ----------------------------------------------- |
| `docs/guides/ai-first-development.md` | Any task — MCP servers, agents, hooks, workflow |

## Available tools — use these, don't reinvent

### MCP servers (project-scoped, in `.mcp.json`)

- **shadcn**: real-time component docs and props. Query before building UI.
- **nextjs**: framework docs + dev-server awareness.
- **playwright**: browser automation for self-QA.
- **structurizr**: C4 architecture diagrams.
- **gemini-image**: pitch images only.

### Plugins

- **Vercel** (`vercel@claude-plugins-official`): `/deploy`, `/vercel-logs`.
- **ECC**: code-reviewer + security-reviewer + typescript-reviewer agents.

## Conventions

- TypeScript strict. No `any`. No non-null assertions unless justified inline.
- Immutable data. New objects, never mutate.
- Files 200–400 lines typical, 800 max.
- Feature-based organization under `src/`.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- One branch per feature. PR before merge.

## Scripts

| Script              | Does                                             |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Start dev server                                 |
| `npm run build`     | Production build                                 |
| `npm run check`     | typecheck + lint + format:check + guard:tokens   |
| `npm run fix`       | lint --fix + format                              |
| `npm run typecheck` | `tsc --noEmit`                                   |
| `npm run test`      | Vitest (infra is wired; no tests checked in yet) |
| `npm run test:e2e`  | Playwright (infra is wired; no specs checked in) |
| `npm run ship`      | check + test + build                             |

Pre-commit runs lint-staged on staged files.

## Security (sensitive documents)

Even though no real OCR runs yet, the same rules apply to anything that
touches user uploads:

- Never log contract content, filenames, or user PII.
- Never persist user documents to disk.
- All uploads validated: MIME allowlist + magic-byte check + 10MB size cap
  (see `src/lib/uploadValidation.ts` and `src/app/api/ocr/route.ts`).
- Anthropic / OCR provider keys server-only. Never expose to client bundle.
- CSP headers; no inline scripts (see `next.config.ts`).
- Strip EXIF / metadata from images before processing.
- Error responses must NOT echo input back to the client.

## Reuse rules

- No color values in component files — only `var(--color-*)`. CI-enforced
  via `scripts/guard-tokens.mjs`.
- No font-family / font-size in component files — only `var(--font-*)` /
  `var(--text-*)`.
- Atoms have no internal state — purely controlled.

## Deployment

- `/deploy` (Vercel plugin) or `vercel deploy`.
- CI on every push: typecheck + lint + format:check + guard:tokens + build.
- Production auto-deploys on merge to `main`.

## Key source files

- `src/app/page.tsx` — landing page: PDF upload → POST /api/ocr → render result.
- `src/app/api/ocr/route.ts` — multipart endpoint, validates MIME + size,
  returns stub text (real OCR backend pending).
- `src/components/organisms/UploadZone.tsx` — drag-drop with magic-byte
  validation; calls `onFile(file)` on success.
- `src/lib/uploadValidation.ts` — shared MIME / magic-byte / size validation.
- `src/lib/utils.ts` — shadcn `cn()` helper.
