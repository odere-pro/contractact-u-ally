## What changed

<!-- One sentence. The diff shows the *what*; here say *why*. -->

## Layer touched (pick one)

- [ ] Backend (`src/app/api/`)
- [ ] UI (`src/components/`, `src/app/*/page.tsx`)
- [ ] Tooling / config (`*.config.*`, `.github/`, `package.json`)
- [ ] Docs only (`docs/`, `*.md`)

## Checklist

- [ ] `npm run check` clean (typecheck + lint + format + guard:tokens)
- [ ] `npm run build` passes locally
- [ ] No `any` types, no non-null assertions without inline reason
- [ ] No hardcoded colors / fonts in `src/components/**` (use tokens — see `.claude/rules/no-hardcoded-tokens.md`)
- [ ] No hardcoded secrets, no `console.log` in committed code
- [ ] No document content / PII logged or persisted server-side
- [ ] If touching uploads: MIME allowlist + size cap enforced
- [ ] If touching `/api/*`: input validated, errors don't echo input back
- [ ] If UI touched: `data-testid` attributes on new interactive elements
- [ ] Conventional commit subject (`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`)

## Security review trigger

If this PR touches any of the following, request a security-reviewer pass:

- File uploads, document parsing, EXIF handling
- Authentication, authorization, session handling
- Anthropic SDK calls, prompt construction
- Rate limiting, CSP / response headers
- Anything reading `process.env.*` on the client side

## Screenshots / preview

<!-- For UI: paste before/after screenshots. For API: paste a curl + response. -->
