# Git rules

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- One logical change per commit. Subject ≤ 72 chars.
- Body explains _why_, not _what_ (the diff shows the what).
- Branch naming: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.
- PR before merging to `main`. CI must be green.
- Never force-push `main`. Never rewrite history on shared branches.
