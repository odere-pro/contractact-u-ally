# Testing rules

- At minimum: one Playwright happy-path + one error-path per user-facing flow.
- No mocking the Anthropic SDK at integration level — stub at the route handler boundary.
- Fixtures in `tests/fixtures/` are anonymized; never check in real user data.
- Tests must be deterministic. Use fixed `Date` when timing matters.
- Run locally before push: `npm run typecheck && npm run test:e2e`.
