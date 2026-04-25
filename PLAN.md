# Plan — Contract Risk Analyzer · UX Wireframes

## Context

`contractact-u-ally` is a Next.js 16 scaffold whose mission is to read a worker's
contract, flag illegal or risky clauses against real labor law, and explain
each finding in plain language for a specific user profile. The repo today
ships a landing page and an OCR upload stub; everything below is the **demo
UX layer** that sits on top of the analysis pipeline once it returns results.

This plan defines the screens, states, and component contract for the demo
flow:

1. Consent → fake auth → upload → processing → results.
2. Results screen as a **side-by-side**: original PDF (with inline risk
   highlights) on the left, simplified explanation per risk on the right.
3. Three result scenarios (all-clear, medium-only, critical) so the demo can
   showcase the human-in-the-loop pathway.
4. Four demo "user profile" buttons in the nav that re-run the simplification
   layer with a different reading level / persona — without re-running OCR.
5. Share + download for both the simplified summary and a combined contract +
   explanation text document.

The wireframes below are ASCII-only on purpose: they are tool-agnostic so they
can drive Figma, shadcn composition, or hand-coded React equally well.

---

## User stories

### Personas (the four demo profiles)

| # | Persona | Reading level | What they need first |
|---|---|---|---|
| P1 | **Migrant Worker** — Maria, just relocated to NL, English is her 3rd language | Plain, B1, no jargon | "Is this contract OK to sign?" |
| P2 | **Student** — Joren, first internship contract | Plain, B2, with examples | "What does each clause mean for me?" |
| P3 | **Senior Pro** — Eva, 12 yrs experience, comparing two offers | Concise, no hand-holding | "Which offer is better and where?" |
| P4 | **Legal Counsel** — Tom, in-house lawyer reviewing a vendor's draft | Statute-grade, with citations | "Show me the law text and the deviation." |

### Epic A · Onboard safely

- **A1 — Give consent before upload**
  *As any user, I want to see exactly what happens to my PDF before I drop it,
  so I can decide whether to continue.*
  **Acceptance:** Consent modal blocks `/app/*`. Required items pre-checked
  and locked; optional items default unchecked. Decline → public landing.
  Accept → write `consent_v1` to localStorage + cookie, route to `/sign-in`.

- **A2 — Sign in (demo auth)**
  *As any user, I want a quick login so my contracts are tied to me alone.*
  **Acceptance:** Magic-link form auto-submits in demo mode (any email
  works). After submit, route to `/app/upload`. Auth cookie required for
  every `/app/*` route.

### Epic B · Upload and process

- **B1 — Upload a PDF**
  *As Maria (P1), I want to drop my PDF and start the check in one action.*
  **Acceptance:** Drag-and-drop or click-to-browse. PDF only, max 25 MB
  (validated client-side via `uploadValidation.ts`). Invalid file → inline
  error, no upload attempted.

- **B2 — Watch progress**
  *As any user, I want to see the analysis is making progress so I don't
  refresh.*
  **Acceptance:** Progress bar + 4-step timeline (OCR → segmentation → law
  cross-check → summary). One step pulses as "now". Cancel button stops
  processing and returns to upload.

- **B3 — Find a recent contract**
  *As Eva (P3), I want to re-open contracts I've already analyzed without
  re-uploading.*
  **Acceptance:** Recent contracts list on `/app/upload` shows filename,
  age, and severity counts (▲ ◐ ◌). Clicking opens that contract's results.

### Epic C · Read the results

- **C1 — See the headline**
  *As Maria (P1), I want a one-glance summary of how risky this contract is.*
  **Acceptance:** Risk rail shows counts per severity at the top of the
  results screen. The most critical card is auto-expanded; everything else
  is collapsed.

- **C2 — Jump to a specific risk**
  *As Tom (P4), I want to navigate straight to the clauses I care about.*
  **Acceptance:** Each row in the rail scrolls **both** PDF and simplified
  panes to the matching clause. Active row gets `aria-current="true"`.
  Filter checkboxes hide/show severities (Critical / Medium / Low / OK).

- **C3 — See the risky text in the original**
  *As any user, I want to verify the AI is pointing to the actual clause —
  not paraphrasing.*
  **Acceptance:** PDF pane renders the real document with inline `<mark>`
  highlights drawn from OCR bounding boxes. Each highlight has a margin
  glyph (▲ ◐ ◌) so it works in grayscale.

- **C4 — Read the simplified explanation**
  *As Maria (P1), I want the legalese rewritten so I actually understand it.*
  **Acceptance:** Right pane shows a card per finding: severity badge, plain
  summary, "what to do" bullets, and two CTAs (Why? · Show law).

- **C5 — Switch the reading level**
  *As Tom (P4) reviewing the same contract Maria signed, I want statute-grade
  detail without re-uploading.*
  **Acceptance:** Profile pills (P1–P4) re-render only the right pane and
  the Why drawer. Zero network calls (verified in DevTools). The PDF pane
  and rail are untouched.

### Epic D · Trust the verdict

- **D1 — Understand "why is this a risk?"**
  *As Maria (P1), I want to know why the AI flagged this clause — and that
  a real law backs it up.*
  **Acceptance:** "Why?" opens a side drawer with the rationale, the cited
  statute (e.g. BW 7:652), and links to read the original Dutch text or a
  plain-language version. Reading level matches the active profile.

- **D2 — Read the law text**
  *As Tom (P4), I want the statute itself, not someone's summary of it.*
  **Acceptance:** "Show law" opens a modal with the unedited source text and
  a permanent link.

### Epic E · Three scenarios

- **E1 — All clear (best case)**
  *As Eva (P3), if my contract is clean I want the app to say so plainly,
  not invent risks.*
  **Acceptance:** When 0 findings, the right pane shows a single green
  "All clear · You can sign with confidence" card. No collapsed risk cards
  beyond the OK section. Footer keeps "Save report".

- **E2 — Worth reviewing (medium)**
  *As Joren (P2), if there are only medium concerns, I want help deciding
  whether to negotiate or accept.*
  **Acceptance:** Right pane leads with "Worth reviewing", followed by
  one card per medium/low finding with negotiation hints. No blocking
  banner.

- **E3 — Critical, human-in-the-loop (worst case)**
  *As Maria (P1), if something is illegal I want the app to **stop me from
  signing** and connect me to a person.*
  **Acceptance:** Top-of-screen STOP banner in critical color. Right pane
  leads with "Do not sign yet" and a Human-in-the-Loop card with two CTAs:
  "Connect me to legal aid →" (primary) and "I'll handle this myself".
  Share button gets a warning chip and danger styling.

### Epic F · Compare

- **F1 — Compare two offers**
  *As Eva (P3), I want to compare an offer with a counter-offer and see
  exactly which clauses got better or worse.*
  **Acceptance:** `/app/compare/:a/:b` shows merged risk rail with diff
  arrows (▲ → ✓, ◐ → ◌, etc) plus dual PDF panes. Selecting a row scrolls
  both PDFs to the matching clause. Footer shows a verdict ("B is safer in
  3 of 4 risks") and a downloadable comparison report.

### Epic G · Share & download

- **G1 — Download a simplified PDF**
  *As Maria (P1), I want to print or save the easy-read version.*
  **Acceptance:** Footer button generates a PDF with the simplified pane
  content + severity badges + sources. Filename: `<original>-summary.pdf`.

- **G2 — Download contract + notes (TXT)**
  *As Tom (P4), I want a single text file containing the original clauses
  and the explanations side-by-side, for archiving.*
  **Acceptance:** TXT export contains every risk in clause order with
  `ORIGINAL · EXPLANATION (severity) · SOURCE` blocks. Generated server-side
  from the same fixture as the UI; snapshot-tested in CI.

- **G3 — Share a simplified link**
  *As Joren (P2), I want to send the summary to my parent without exposing
  the full contract.*
  **Acceptance:** Share dialog defaults to "Simplified summary only".
  Generates `/app/share/:token` (read-only, simplified pane only).
  Optional: require recipient sign-in, expiry (1h / 24h / 7d / never).
  When critical findings exist, a warning chip is shown and recipients see
  the same severity badge.

### Epic H · Accessibility & guardrails

- **H1 — Color-blind safe severity**
  *As a deuteranopic user, I want to tell critical from medium without
  relying on color.*
  **Acceptance:** Every severity uses **icon + label + color** (▲ ◐ ◌ ✓).
  `axe-core` reports zero contrast issues on every results scenario.

- **H2 — Keyboard navigation**
  *As a screen-reader user, I want to tab through the results in reading
  order.*
  **Acceptance:** Tab order: rail → PDF → simplified → footer. Active rail
  row syncs `aria-current`. Why drawer is a focus trap with `Esc` to close.

- **H3 — Consent guard**
  *As a privacy-conscious user, I never want my PDF to leave my browser
  before I've consented.*
  **Acceptance:** Missing `consent_v1` redirects from any `/app/*` to
  `/consent`. Missing auth cookie redirects to `/sign-in`. Both checks are
  server-side in `middleware.ts`.

### Story → wireframe map

| Story | Wireframe(s) |
|---|---|
| A1 | §1 Consent |
| A2 | §2 Sign-in |
| B1 | §4 Upload |
| B2 | §5 Processing |
| B3 | §4 Upload (Recent) |
| C1–C4 | §6 Results main |
| C5 | §3 App shell + §6 Results |
| D1 | §8 Why drawer |
| D2 | §6 (Law modal CTA) |
| E1 | §7a Best |
| E2 | §7b Medium |
| E3 | §7c Critical |
| F1 | §9 Compare |
| G1–G3 | §10 Share · §11 TXT export |
| H1–H3 | All scenarios + middleware |

---

## Design principles

- **Two-pane diff feel.** Source on the left, explanation on the right — like
  a code review. Risk = the "diff."
- **Risk is the primary navigation.** A persistent left rail lists every
  finding; clicking jumps both panes to that clause.
- **Severity is color + shape, not color alone.** Low / Medium / High map to
  three distinct icons + labels (a11y, color-blind safe).
- **Profile is a lens, not a route.** Switching profile re-renders the right
  pane only — no reload, no re-upload.
- **Trust through provenance.** Every risk has an "Why is this risky?" button
  that opens the law citation, also simplified to the active profile.
- **Sensitive data → gated.** Consent first, fake auth second, upload last.
  No PDF leaves the client until consent + auth are both true.

---

## Information architecture

```
/                         Landing (existing) — CTA → /consent
/consent                  Cookie + data-processing consent gate
/sign-in                  Fake auth (email + "magic link" stub)
/app                      Authenticated shell
  /app/upload             Drop zone + recent contracts
  /app/processing/:id     Skeleton + progress
  /app/contract/:id       Results (single contract view) ← MAIN SCREEN
  /app/compare/:a/:b      Two contracts side-by-side
  /app/share/:token       Public read-only simplified view
```

Demo-only nav buttons (top right of `/app/*`) cycle the four profiles:
**Migrant Worker · Student · Senior Pro · Legal Counsel**.

---

## Wireframes

### 1. Consent window (modal over landing)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░  contractact-u-ally — landing  ░░░░░░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                                     │
│        ╔═══════════════════════════════════════════════════╗        │
│        ║  Before we read your contract                  ✕  ║        │
│        ║───────────────────────────────────────────────────║        │
│        ║                                                   ║        │
│        ║  Your PDF is sensitive. We need your consent to:  ║        │
│        ║                                                   ║        │
│        ║   ☑  Process the document to detect risks         ║        │
│        ║   ☑  Store an encrypted copy for 30 days          ║        │
│        ║   ☐  Use anonymized excerpts to improve the model ║        │
│        ║   ☐  Send me product updates                      ║        │
│        ║                                                   ║        │
│        ║  Required items are pre-checked and locked.       ║        │
│        ║  Read the [Privacy Notice ↗] · [Cookie Policy ↗]  ║        │
│        ║                                                   ║        │
│        ║                       [ Decline ]  [ Accept → ]   ║        │
│        ╚═══════════════════════════════════════════════════╝        │
└─────────────────────────────────────────────────────────────────────┘
```

- "Decline" returns to public landing (no app access).
- "Accept" persists `consent_v1` in `localStorage` + httpOnly cookie, routes
  to `/sign-in`.

---

### 2. Fake authorization

```
┌─────────────────────────────────────────────────────────────────────┐
│  contractact-u-ally                                       [ Help ]  │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│                      ┌─────────────────────────┐                    │
│                      │   🔒  Sign in           │                    │
│                      │─────────────────────────│                    │
│                      │                         │                    │
│                      │   Email                 │                    │
│                      │   ┌───────────────────┐ │                    │
│                      │   │ you@example.com   │ │                    │
│                      │   └───────────────────┘ │                    │
│                      │                         │                    │
│                      │   ┌───────────────────┐ │                    │
│                      │   │  Send magic link  │ │                    │
│                      │   └───────────────────┘ │                    │
│                      │                         │                    │
│                      │   ── or continue with ──│                    │
│                      │   [ Google ] [ Apple ]  │                    │
│                      │                         │                    │
│                      │   ⓘ Demo mode — any     │                    │
│                      │     email signs you in. │                    │
│                      └─────────────────────────┘                    │
│                                                                     │
│  Why we ask: contracts contain salary, address, and ID data.        │
│  Auth keeps your documents tied to you alone.                       │
└─────────────────────────────────────────────────────────────────────┘
```

- "Magic link" auto-submits in demo mode after 800ms.
- Successful auth → `/app/upload`.

---

### 3. App shell (persistent)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ▣ contractact-u-ally   Upload  My Contracts  Compare       ◐ Profile ▾  ⌄  │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  Demo profile (changes simplification only):                         │  │
│   │  [● Migrant Worker]  [ Student ]  [ Senior Pro ]  [ Legal Counsel ]  │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   ┌─ page content ──────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │                          (varies per route)                         │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- The four profile buttons are a `RadioGroup` styled as pill buttons. The
  active one updates the right-pane simplification + the law-citation
  rewriter. **Never** triggers a re-upload or re-OCR.

---

### 4. Upload screen (`/app/upload`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  App shell ............................................................... │
│──────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│   ┌──────────────────────────────┐   ┌───────────────────────────────────┐  │
│   │                              │   │  Recent contracts                 │  │
│   │      ⇪  Drop your PDF here   │   │───────────────────────────────────│  │
│   │      or click to browse      │   │  📄 NL-2025-Probation.pdf  • 2d  │  │
│   │                              │   │     ▲ 1 critical · 2 medium      │  │
│   │   Max 25 MB · PDF only       │   │                                  │  │
│   │                              │   │  📄 SE-NonCompete.pdf      • 7d  │  │
│   │   ┌────────────────────┐     │   │     ✓ no critical risks          │  │
│   │   │  Choose file       │     │   │                                  │  │
│   │   └────────────────────┘     │   │  📄 Freelance-DE.pdf       • 31d │  │
│   │                              │   │     ◐ 3 medium · 1 low           │  │
│   │   ⓘ We never share your      │   │                                  │  │
│   │     document with third      │   │  [ Compare two contracts → ]     │  │
│   │     parties.                 │   │                                  │  │
│   └──────────────────────────────┘   └───────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### 5. Processing state (`/app/processing/:id`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  App shell ............................................................... │
│──────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│            Reading  NL-2025-Probation.pdf …                                  │
│            ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱  68%                                         │
│                                                                              │
│            ✓  OCR complete (8 pages, 4,212 words)                            │
│            ✓  Clause segmentation                                            │
│            ◐  Cross-checking against Dutch labor law…                        │
│            ◌  Drafting plain-language summary                                │
│                                                                              │
│            ⓘ This usually takes 20–40 seconds.                               │
│                                                                              │
│            [ Cancel ]                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### 6. Results — MAIN SCREEN (`/app/contract/:id`)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  App shell + profile buttons ................................................................. │
│──────────────────────────────────────────────────────────────────────────────────────────────────│
│ ┌────── Risks ──────┐ ┌──── Original (PDF) ─────────────┐ ┌──── For you · Migrant Worker ─────┐ │
│ │ Summary           │ │  page 2 / 8     − ▭ +    ⤓ ⤒    │ │                                   │ │
│ │  ▲ 1 critical     │ │                                 │ │ ▲ §4.2 · Probation period         │ │
│ │  ◐ 2 medium       │ │  …………… §4.2 ………………………………………    │ │ ───────────────────────────────── │ │
│ │  ◌ 3 low          │ │  ▓▓▓▓▓ probation 9 months ▓▓▓   │ │ Your contract sets a 9-month      │ │
│ │  ✓ rest OK        │ │  ▲ critical                     │ │ probation. Dutch law caps this    │ │
│ │                   │ │                                 │ │ at 2 months for a 1-year          │ │
│ │ ───── jump to ──  │ │  …………… §6 ……………………………………        │ │ contract. Anything longer is      │ │
│ │ ▲ §4.2 Probation  │ │  ░░░░ 6-month non-compete ░░░   │ │ NOT enforceable.                  │ │
│ │ ◐ §6   Non-comp.  │ │  ◐ medium                       │ │                                   │ │
│ │ ◐ §8   Overtime   │ │                                 │ │ What to do                        │ │
│ │ ◌ §11  Notice     │ │  …………… §8 ……………………………………        │ │  • Ask for it to be reduced to    │ │
│ │ ◌ §13  Travel     │ │  ░░░ overtime unpaid ░░░░       │ │    2 months in writing.           │ │
│ │ ◌ §15  Equipment  │ │  ◐ medium                       │ │  • If signed, the cap still       │ │
│ │ ✓ §1–3 standard   │ │                                 │ │    applies — you can leave        │ │
│ │ ✓ §5   wages      │ │  …………… §11 …………………………………         │ │    without notice after month 2. │ │
│ │ ✓ §9   leave      │ │  ░ notice 1 month ░             │ │                                   │ │
│ │                   │ │  ◌ low                          │ │ [ ⓘ Why is this a risk? ]         │ │
│ │ ─────────────────-│ │                                 │ │ [ 📄 Show law (BW 7:652) ]       │ │
│ │ Filter:           │ │  …                              │ │                                   │ │
│ │ ☑ critical        │ │                                 │ │ ───────────────────────────────── │ │
│ │ ☑ medium          │ │  ◀ 1 2 [3] 4 5 6 7 8 ▶          │ │ ◐ §6 · Non-compete  ▾             │ │
│ │ ☑ low             │ │                                 │ │ ◐ §8 · Overtime     ▾             │ │
│ │ ☐ ok              │ │                                 │ │ ◌ §11 · Notice      ▾             │ │
│ └───────────────────┘ └─────────────────────────────────┘ └───────────────────────────────────┘ │
│                                                                                                  │
│  Footer:  [ ⤓ Download simplified (PDF) ]  [ ⤓ Download contract + notes (TXT) ]  [ 🔗 Share ]   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Behaviors:

- **Left rail** = scroll-spy. Active risk syncs both panes.
- **Center pane** = real PDF with inline highlight overlays (`<mark>`-style)
  drawn from the OCR bounding boxes. Each highlight has a severity badge
  glyph (▲ ◐ ◌) docked to the margin so it works in grayscale.
- **Right pane** = simplified explanation, written for the active profile.
  Each card has two CTAs:
  - `Why is this a risk?` opens a side drawer (see §8) with the legal
    rationale, also simplified to the profile.
  - `Show law` opens the cited statute / clause text in a modal.
- **Footer** persists download/share actions.

---

### 7. Three result scenarios

#### 7a. Best case — all clear

```
┌── Risks ──────────┐ ┌── Original ──────────────┐ ┌── For you ───────────────┐
│ Summary           │ │  …all pages…             │ │ ✅  All clear             │
│  ✓ no risks       │ │  (no highlights)         │ │ ─────────────────────── │
│                   │ │                          │ │ We compared every       │
│ ───── jump to ──- │ │                          │ │ clause to Dutch labor   │
│ ✓ §1  Parties     │ │                          │ │ law. Nothing in this    │
│ ✓ §4  Probation   │ │                          │ │ contract requires your  │
│ ✓ §5  Wages       │ │                          │ │ attention.              │
│ ✓ §6  Non-comp.   │ │                          │ │                         │
│ ✓ §8  Overtime    │ │                          │ │ You can sign with       │
│ ✓ §11 Notice      │ │                          │ │ confidence.             │
│                   │ │                          │ │                         │
│ Filter: ☐ ok      │ │                          │ │ [ ⤓ Save report ]       │
└───────────────────┘ └──────────────────────────┘ └─────────────────────────┘
```

#### 7b. Medium case — informational only

```
┌── Risks ──────────┐ ┌── Original ──────────────┐ ┌── For you ───────────────┐
│ Summary           │ │  ░░ §6 non-compete ░░    │ │ ◐  Worth reviewing       │
│  ◐ 2 medium       │ │  ◐ medium                │ │ ─────────────────────── │
│  ◌ 1 low          │ │                          │ │ Two clauses are unusual │
│                   │ │  ░ §11 notice ░          │ │ but legal. You can      │
│ ───── jump to ──- │ │  ◐ medium                │ │ accept them, or ask     │
│ ◐ §6  Non-comp.   │ │                          │ │ to soften them.         │
│ ◐ §11 Notice      │ │  · §13 travel ·          │ │                         │
│ ◌ §13 Travel      │ │  ◌ low                   │ │ ◐ §6 · Non-compete  ▾   │
│ ✓ rest OK         │ │                          │ │ ◐ §11 · Notice      ▾   │
│                   │ │                          │ │ ◌ §13 · Travel      ▾   │
│                   │ │                          │ │                         │
│                   │ │                          │ │ [ Explore each → ]      │
└───────────────────┘ └──────────────────────────┘ └─────────────────────────┘
```

#### 7c. Worst case — critical, human-in-the-loop

```
┌── Risks ──────────┐ ┌── Original ──────────────┐ ┌── For you ──────────────────────────────┐
│ ▲ STOP — review   │ │  ▓▓▓ §4.2 9-month ▓▓▓    │ │ ▲  CRITICAL — do not sign yet           │
│ Summary           │ │  ▲ critical              │ │ ──────────────────────────────────────  │
│  ▲ 1 CRITICAL     │ │                          │ │ One clause violates Dutch law and would │
│  ◐ 2 medium       │ │  ░ §6 non-compete ░      │ │ leave you with no legal probation cap.  │
│  ◌ 3 low          │ │  ◐ medium                │ │                                         │
│                   │ │                          │ │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ───── jump to ──- │ │  ░ §8 overtime ░         │ │ ┃ Recommended next step               ┃ │
│ ▲ §4.2 Probation  │ │  ◐ medium                │ │ ┃ ─────────────────────────────────── ┃ │
│ ◐ §6  Non-comp.   │ │                          │ │ ┃ Have a person review this with you. ┃ │
│ ◐ §8  Overtime    │ │                          │ │ ┃ We can connect you to a free legal  ┃ │
│ ◌ §11 Notice      │ │                          │ │ ┃ aid contact in your region.         ┃ │
│ ◌ §13 Travel      │ │                          │ │ ┃                                     ┃ │
│ ◌ §15 Equipment   │ │                          │ │ ┃ [ Connect me to legal aid → ]       ┃ │
│                   │ │                          │ │ ┃ [ I'll handle this myself ]         ┃ │
│ ⚠ A human review  │ │                          │ │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│ is recommended.   │ │                          │ │                                         │
└───────────────────┘ └──────────────────────────┘ └─────────────────────────────────────────┘
```

The critical scenario shows a **blocking banner** above the right pane and a
prominent human-in-the-loop CTA. The "Download / Share" footer remains, but
the share action carries a warning chip ("Contains critical findings") so the
recipient sees the severity immediately.

---

### 8. "Why is this a risk?" drawer

Slides in from the right over the right pane.

```
┌───── For you · Migrant Worker ─────┐  ┌── Why is this a risk? ─────────────┐
│ ▲ §4.2 Probation period            │  │                              ✕     │
│ Your contract sets 9 months …      │  │ §4.2 Probation                     │
│                                    │  │ ─────────────────────────────────  │
│ [ ⓘ Why is this a risk? ] ◀ click  │  │ The law (BW 7:652) says probation  │
│ [ 📄 Show law ]                     │  │ may not exceed 2 months for a      │
│                                    │  │ contract of 1 year or longer.      │
│                                    │  │                                    │
│                                    │  │ Anything beyond that is void —     │
│                                    │  │ meaning the clause doesn't apply,  │
│                                    │  │ even if you signed it.             │
│                                    │  │                                    │
│                                    │  │ ─── Source ───                     │
│                                    │  │ Burgerlijk Wetboek 7:652           │
│                                    │  │ [ Read original (Dutch) ↗ ]        │
│                                    │  │ [ Read in plain language ↗ ]      │
│                                    │  │                                    │
│                                    │  │ Reading level: Migrant Worker      │
│                                    │  │ [ change ▾ ]                       │
└────────────────────────────────────┘  └────────────────────────────────────┘
```

- The "Read original" / "Read in plain language" toggle re-renders the
  citation only — same simplification engine as the right pane, scoped to the
  legal source text.

---

### 9. Compare contracts side-by-side (`/app/compare/:a/:b`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  App shell + profile buttons                                                 │
│──────────────────────────────────────────────────────────────────────────────│
│ Compare:  [ NL-2025-Probation.pdf ▾ ]   vs   [ NL-2025-Offer-v2.pdf ▾ ]      │
│                                                                              │
│ ┌── Risks (merged) ──┐ ┌─── Contract A ───────┐ ┌─── Contract B ───────────┐│
│ │ ▲ A:1  B:0         │ │  ▓ §4.2 9-month ▓    │ │  · §4.2 2-month ·        ││
│ │ ◐ A:2  B:1         │ │  ▲ critical          │ │  ✓ ok                    ││
│ │ ◌ A:3  B:2         │ │                      │ │                          ││
│ │                    │ │  ░ §6 non-compete ░  │ │  ░ §6 non-compete ░      ││
│ │ ── side-by-side ── │ │  ◐ medium · 6mo      │ │  ◌ low · 3mo             ││
│ │ §4.2 ▲ → ✓         │ │                      │ │                          ││
│ │ §6   ◐ → ◌         │ │  ░ §8 overtime ░     │ │  · §8 overtime ·         ││
│ │ §8   ◐ → ✓         │ │  ◐ medium            │ │  ✓ ok                    ││
│ │ §11  ◌ = ◌         │ │                      │ │                          ││
│ │                    │ │                      │ │                          ││
│ │ ▶ B is safer in    │ │                      │ │                          ││
│ │   3 of 4 risks.    │ │                      │ │                          ││
│ └────────────────────┘ └──────────────────────┘ └──────────────────────────┘│
│                                                                              │
│ [ ⤓ Compare report (PDF) ]   [ Open A → ]   [ Open B → ]                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

- The merged left rail diff-highlights changes (▲ → ✓, ◐ → ◌, etc).
- Choosing a row scrolls **both** PDF panes to the matching clause.

---

### 10. Share & download

Triggered from the footer of the results screen.

```
                    ┌─── Share or download ──────────────────────────┐
                    │                                            ✕   │
                    │   What do you want to share?                   │
                    │                                                │
                    │   ◉  Simplified summary only (safe)            │
                    │   ◯  Contract + simplified notes (TXT)         │
                    │   ◯  Full original PDF + notes (sensitive)     │
                    │                                                │
                    │   ── Share via ──                              │
                    │   [ 🔗 Copy link ]  [ ✉ Email ]  [ ⤓ Download ]│
                    │                                                │
                    │   Link expires in:  [ 24h ▾ ]                  │
                    │   ☑  Require recipient to sign in              │
                    │                                                │
                    │   ⚠ This contract has 1 CRITICAL finding.      │
                    │     Recipients will see this badge.            │
                    └────────────────────────────────────────────────┘
```

- "Copy link" generates `/app/share/:token`, a read-only public-or-gated view
  of just the simplified pane.
- "Download contract + simplified notes (TXT)" produces a single text file:

  ```
  CONTRACTACT-U-ALLY · simplified report
  Profile: Migrant Worker · Generated: 2026-04-25

  ─── §4.2 Probation period ─────────────────────────────────────
  ORIGINAL:
    "The probation period shall be 9 (nine) months …"
  EXPLANATION (▲ critical):
    Your contract sets 9 months. Dutch law caps this at 2 months
    for a 1-year contract. Anything longer is NOT enforceable.
  SOURCE:
    Burgerlijk Wetboek 7:652
  ───────────────────────────────────────────────────────────────
  …
  ```

---

## Component contract (for build)

| Component | Where | Owns |
|---|---|---|
| `ConsentDialog` | `/consent` | localStorage flag + cookie write |
| `FakeAuthForm` | `/sign-in` | demo-mode auto-submit, cookie set |
| `ProfileSwitcher` | App shell | active profile in React context |
| `UploadDropzone` | `/app/upload` | PDF validation, `/api/ocr` POST |
| `RecentContracts` | `/app/upload` | summary list w/ severity counts |
| `ProcessingTimeline` | `/app/processing/:id` | server-sent progress events |
| `RiskRail` | results | scroll-spy + filter + counts |
| `PdfPane` | results | PDF.js render + highlight overlays |
| `SeverityBadge` | shared | ▲ ◐ ◌ ✓ icon + label, a11y safe |
| `SimplifiedPane` | results | per-risk cards keyed by profile |
| `WhyDrawer` | results | citation + simplified rationale |
| `LawModal` | results | original statute text |
| `CompareView` | `/app/compare/:a/:b` | merged rail + dual PDF panes |
| `ShareDialog` | results footer | link gen, scope picker |
| `DownloadMenu` | results footer | TXT + PDF export |
| `CriticalBanner` | results | shown only in worst-case scenario |
| `HumanInTheLoopCTA` | results, critical only | legal-aid handoff stub |

---

## Critical files to modify / create

- `src/app/(public)/page.tsx` — add CTA → `/consent`.
- `src/app/consent/page.tsx` *(new)* — `ConsentDialog`.
- `src/app/sign-in/page.tsx` *(new)* — `FakeAuthForm`.
- `src/app/app/layout.tsx` *(new)* — App shell with `ProfileSwitcher`.
- `src/app/app/upload/page.tsx` *(new)*.
- `src/app/app/processing/[id]/page.tsx` *(new)*.
- `src/app/app/contract/[id]/page.tsx` *(new)* — main results screen.
- `src/app/app/compare/[a]/[b]/page.tsx` *(new)*.
- `src/app/app/share/[token]/page.tsx` *(new)*.
- `src/components/organisms/risk-rail/` *(new)*.
- `src/components/organisms/pdf-pane/` *(new)*.
- `src/components/organisms/simplified-pane/` *(new)*.
- `src/components/organisms/why-drawer/` *(new)*.
- `src/components/organisms/share-dialog/` *(new)*.
- `src/components/atoms/severity-badge/` *(new)*.
- `src/lib/consent.ts` *(new)* — read/write consent flags.
- `src/lib/profile.ts` *(new)* — profile context + types.
- `src/lib/fixtures/scenarios.ts` *(new)* — three demo result fixtures
  (best / medium / worst) so the UI works without a live analysis.

Reuse:
- `src/lib/uploadValidation.ts` (existing) — PDF size + MIME guard.
- `src/components/ui/*` (shadcn) — Dialog, Drawer, Tabs, RadioGroup, Sheet,
  ScrollArea, Tooltip.
- `/api/ocr` (existing stub) — keep contract; add `/api/analysis/[id]` next.

---

## Verification

1. **Storybook-less visual pass.** With fixtures from
   `src/lib/fixtures/scenarios.ts`, hit `/app/contract/best`,
   `/app/contract/medium`, `/app/contract/worst` — each renders the
   correct scenario layout (§7).
2. **Profile lens.** On any results page, cycling the four profile buttons
   updates only the right pane and the `WhyDrawer` text — no network calls,
   verified in DevTools Network tab.
3. **Risk navigation.** Clicking any row in `RiskRail` scrolls both PDF and
   simplified pane to that clause; the active row gets `aria-current="true"`.
4. **A11y.** `axe` clean on each results scenario; severity is conveyed by
   icon + label + color; tab order: rail → PDF → simplified → footer.
5. **Consent gate.** Clearing `localStorage.consent_v1` redirects from any
   `/app/*` route back to `/consent`. Same for missing auth cookie →
   `/sign-in`.
6. **Download.** TXT export contains every risk in order with original
   excerpt + explanation + source — diff against a snapshot fixture.
7. **Share link.** `/app/share/:token` renders the simplified pane only,
   never the original PDF, even when token holder is unauthenticated (when
   "require sign-in" is off).
8. **Playwright smoke.** Upload → processing → results (worst case) →
   open Why drawer → switch profile → download TXT — single happy-path test.
