<div align="center">

# contractact-u-ally

**Know what you signed — in 60 seconds, in your language.**

[![CI](https://github.com/odere-pro/contractact-u-ally/actions/workflows/ci.yml/badge.svg)](https://github.com/odere-pro/contractact-u-ally/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## What it does

A user uploads their employment contract and instantly gets a plain-language report in their own language — every illegal clause flagged against the exact Dutch or Swedish law it violates, with clear next steps to fix it.

This repository is the **scaffold**: tech stack, tooling, Claude Code config, and a landing page that uploads a PDF to an OCR endpoint stub. Domain logic (rule loading, clause analysis, citation validation, results UI) lives on feature branches and merges in incrementally.

## Why it exists

Most workers — especially migrants — never learn what their contract actually says. The text is dense, the language is foreign, and labor-law literacy is expensive. Illegal probation lengths, unenforceable non-competes, and underpaid overtime all hide in plain sight. `contractact-u-ally` reads the contract, checks it against the real labor code, and explains what's wrong in the language the worker speaks.

## Tech stack

- **Framework**: Next.js 16 (App Router) · React 19
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4 · shadcn/ui · CSS custom-property design tokens
- **AI**: Anthropic SDK (planned, behind `/api/*`)
- **Validation**: Zod
- **Hosting**: Vercel
- **Tooling**: ESLint · Prettier · Husky + lint-staged · Vitest · Playwright
- **Claude Code**: project-scoped MCP servers (shadcn, nextjs, playwright,
  structurizr, gemini-image), agents, hooks, and rules under `.claude/`

## Quick start

```bash
git clone https://github.com/odere-pro/contractact-u-ally.git
cd contractact-u-ally
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>, drop a PDF onto the upload zone, and click
**Parse contract**. The request hits `/api/ocr` which today returns a
placeholder — proof the upload pipeline is wired end-to-end.

## Project layout

```
.
├── .claude/              # Claude Code config: agents, hooks, rules, skills
├── .github/              # CI workflow + PR template
├── docs/guides/          # How-we-work playbooks (frontend, backend, demo, …)
├── public/               # Static assets
├── scripts/              # Dev scripts (preflight, guard-tokens)
├── src/
│   ├── app/              # App Router pages + API routes
│   │   ├── api/ocr/      # Multipart upload → OCR stub
│   │   ├── layout.tsx
│   │   └── page.tsx      # Landing page (PDF upload UI)
│   ├── components/       # ui/ (shadcn) · atoms/ · organisms/
│   ├── lib/              # Shared utilities (cn, uploadValidation)
│   └── styles/           # Design tokens
├── tests/                # Test infra scaffolding (mocks, setup)
└── CLAUDE.md             # AI-assisted development conventions
```

## Working in this repo

- **For humans**: Read the relevant guide in [`docs/guides/`](docs/guides/)
  before starting a task. Each guide is under 300 lines and focused on a
  single surface (frontend, backend, UX/UI, demo, pitching).
- **For AI assistants**: Read [`CLAUDE.md`](CLAUDE.md). It defines the
  default agent routing, MCP servers, conventions, security rules, and
  reuse rules.
- **Quality gates**:
  ```bash
  npm run check    # typecheck + lint + format:check + guard:tokens
  npm run build    # production build must pass
  ```
  CI runs both on every push and pull request.

## Status

Setup-only scaffold. Real OCR provider integration, contract analysis, and
results UI are tracked on feature branches.

## License

[MIT](LICENSE)
