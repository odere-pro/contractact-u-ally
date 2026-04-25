# Next.js rules

- App Router only. No `pages/`.
- Server Components by default. Add `"use client"` only when required (state, effects, event handlers).
- API routes return `NextResponse.json(...)`. Use HTTP status codes correctly.
- Never pass secrets to the client. Server-only modules import from `server-only`.
- Keep route handlers thin — delegate to `src/lib/*`.
- Use `revalidatePath` / `revalidateTag` for data freshness instead of ad-hoc refetch.
- `middleware.ts` only for auth and redirects — not for business logic.
