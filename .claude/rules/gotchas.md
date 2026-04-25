# Gotchas workflow

`docs/gotchas.md` is a running log of non-obvious pitfalls. Claude treats it as authoritative project memory. The file may not exist yet — create it on the first qualifying entry.

## Read it

- At the start of any debugging session, `cat docs/gotchas.md` (or `Read` it) before proposing hypotheses.
- When touching one of these areas, scan for matching entries:
  `vercel`, `claude-code`, `playwright`, `next.js`, `shadcn`, `tailwind`, `ecc`, `tooling`, `typescript`.

## Append to it

Add a new gotcha whenever **all three** hold:

1. A bug, misconfiguration, or surprise cost ≥ 15 min to diagnose.
2. The root cause wasn't obvious from the error alone.
3. It's likely to recur (same stack, new files).

Do **not** add:

- One-off typos
- Missing imports
- Fixes that were obvious from the error message
- Anything fixed by restarting the dev server
- Anything already covered by an existing entry — update the existing one instead

## Format (must match the template in `docs/gotchas.md`)

```
### [YYYY-MM-DD] Short symptom
**Area:** <tag>
**Symptom:** …
**Cause:** …
**Fix:** …
**Detect:** …
```

Keep each entry ≤ 8 lines. Use today's date (UTC).

## Prune

When closing a PR that removes the cause (dependency upgrade, permanent config fix), delete the matching gotcha in the same PR. Don't leave stale entries.

## Link from PR descriptions

If a PR is the fix for a gotcha (old or new), include `Gotcha: <anchor>` in the PR body so the history is searchable.
