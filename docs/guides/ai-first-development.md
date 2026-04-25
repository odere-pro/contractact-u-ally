# AI-First Development

This project is designed for AI-assisted development with Claude Code. Everything below is
pre-configured — no manual setup needed beyond the env keys.

---

## Quick start

```bash
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY
npm install
npm run dev                  # → http://localhost:3000
```

Then launch Claude Code — AI tooling activates automatically:

```bash
claude
```

First prompt: `Read CLAUDE.md. Then build the contract analysis results page using shadcn/ui.`

---

## MCP servers (project-scoped, in `.mcp.json`)

Five servers connect automatically when you open a Claude session.

| MCP             | Purpose                               | Example prompt                                                 |
| --------------- | ------------------------------------- | -------------------------------------------------------------- |
| **shadcn**      | Component docs + correct props        | `use shadcn mcp to show Card props`                            |
| **nextjs**      | Dev-server awareness + framework docs | `use nextjs mcp to check server status`                        |
| **playwright**  | Browser automation + self-QA          | `use playwright mcp to test the upload flow on localhost:3000` |
| **structurizr** | C4 architecture diagrams              | `render a C4 context diagram for this system`                  |

Always say **"use playwright mcp"** explicitly — otherwise Claude defaults to the Bash CLI.

---

## Project agents (in `.claude/agents/`)

Project-scoped agents live in the repo and travel with it. They know this stack, scripts,
and security model.

| Agent                    | Trigger                                                      | What it does                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **full-stack-developer** | Manual: `Use the full-stack-developer agent to plan <task>.` | Read-only orchestrator. Routes the request to the right specialist subagents and MCPs, and enforces the discover → plan → TDD → implement → review → ship pipeline. |

Use it for any non-trivial feature, security-sensitive change (uploads, API routes,
`src/lib/anthropic.ts`), or end-to-end workflow. It returns a routing plan; the parent
session executes.

---

## ECC agents (user-level, in `~/.claude/`)

Agents run automatically during the session and can be invoked directly.
The `full-stack-developer` orchestrator composes these.

| Agent                   | Auto-triggers           | What it does                            |
| ----------------------- | ----------------------- | --------------------------------------- |
| **code-reviewer**       | After code write/modify | Quality, patterns, best practices       |
| **security-reviewer**   | Auth, API, upload code  | OWASP Top 10, secret leaks, PII in logs |
| **typescript-reviewer** | `.ts` / `.tsx` edits    | Type safety, strict idioms              |

Invoke manually:

```
Use the security-reviewer agent to check src/app/api/ocr/route.ts.
```

---

## Hooks (auto-run, no action needed)

| Event         | What runs                                         |
| ------------- | ------------------------------------------------- |
| Session start | Checks `.env.local`, reports missing keys         |
| Edit / Write  | Prettier formats the file automatically           |
| Session stop  | `npm run build` — catches type errors before push |

---

## Project rules (auto-loaded by Claude)

| Rule file                          | Governs                                       |
| ---------------------------------- | --------------------------------------------- |
| `.claude/rules/typescript.md`      | Strict types, immutability, Zod at boundaries |
| `.claude/rules/nextjs.md`          | App Router, Server Components, thin routes    |
| `.claude/rules/security.md`        | Document handling, secrets, upload validation |
| `.claude/rules/testing.md`         | Playwright, no SDK mocks                      |
| `.claude/rules/git.md`             | Conventional commits, PR before merge         |
| `.claude/rules/gotchas.md`         | Non-obvious pitfalls; read before debugging   |
| `.claude/rules/no-hardcoded-tokens.md` | Design-token enforcement in components    |

---

## Workflow: discover → plan → TDD → implement → review → ship

Every non-trivial task follows this pipeline:

1. **Discover** — search for existing implementations with `gh search repos` / `gh search code`
   before writing anything new.
2. **Plan** — open Claude Code, describe the feature, ask for a routing plan from
   `full-stack-developer`. Align on files and interfaces before touching code.
3. **TDD** — write the failing test first (`npm run test`), then write the implementation.
4. **Implement** — code-reviewer and typescript-reviewer fire automatically after each file
   save. Address CRITICAL and HIGH findings before moving on.
5. **Review** — run `npm run check` (typecheck + lint + format + token guard). Fix everything
   that fails.
6. **Ship** — `npm run ship` (check + test + build). Open a PR. CI runs the same gates.

---

## Practical prompt recipes

### Upload + OCR stub

```
Build the PDF upload component using shadcn/ui Card and Button.
Drag-and-drop + click-to-browse. Accepts application/pdf only. Max 10 MB.
Show filename, progress indicator, and cancel button per file.
On success call POST /api/ocr and display the stub response.
Server Component wrapper, "use client" only on the dropzone.
```

### Contract analysis route

```
Implement POST /api/analyze. Accept { ocrText: string, locale: "nl" | "sv" }.
Validate with zod. Call the Anthropic client with a structured-output prompt
that returns { clauses: Array<{ text, isIllegal, law, explanation }> }.
Never log ocrText. Stub model call behind src/lib/analyze.ts so tests can mock.
Return 200 + JSON on success, 4xx on validation, 5xx on model error.
```

### Self-QA with Playwright MCP

```
Use playwright mcp to:
1. Navigate to localhost:3000
2. Drop tests/fixtures/sample-contract.pdf onto the upload zone
3. Click "Parse contract"
4. Assert the results section is visible within 30 seconds
5. Take a screenshot and save to tests/screenshots/upload-flow.png
```

### Architecture diagram

```
Use structurizr mcp to render a C4 context diagram showing:
- User uploads PDF via browser
- Landing page → /api/ocr → OCR stub (→ future Anthropic)
- Results displayed in browser
Export as SVG to docs/diagrams/c4-context.svg
```

---

## Scripts reference

| Command               | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | Start dev server (hot reload)                   |
| `npm run build`       | Production build                                |
| `npm run check`       | Typecheck + lint + format:check + guard:tokens  |
| `npm run fix`         | Lint --fix + format (auto-apply)                |
| `npm run typecheck`   | `tsc --noEmit`                                  |
| `npm run lint`        | ESLint                                          |
| `npm run test`        | Vitest unit tests                               |
| `npm run test:e2e`    | Playwright tests (headless)                     |
| `npm run test:e2e:ui` | Playwright UI mode                              |
| `npm run ship`        | `check` + `test` + `build` — run before pushing |

Pre-commit runs lint-staged automatically (lint + format on staged files).
