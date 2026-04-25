# User Stories — Contract Risk Analyzer

> Companion to [`PLAN.md`](./PLAN.md) and [`design/wireframes.html`](./design/wireframes.html).
> Each story names a persona, the desired outcome, and the acceptance criteria
> the implementation must satisfy. Wireframe references in the final map.

---

## Personas (the four demo profiles)

| #   | Persona                                                                       | Reading level                 | What they need first                      |
| --- | ----------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------- |
| P1  | **Migrant Worker** — Maria, just relocated to NL, English is her 3rd language | Plain, B1, no jargon          | "Is this contract OK to sign?"            |
| P2  | **Student** — Joren, first internship contract                                | Plain, B2, with examples      | "What does each clause mean for me?"      |
| P3  | **Senior Pro** — Eva, 12 yrs experience, comparing two offers                 | Concise, no hand-holding      | "Which offer is better and where?"        |
| P4  | **Legal Counsel** — Tom, in-house lawyer reviewing a vendor's draft           | Statute-grade, with citations | "Show me the law text and the deviation." |

---

## Epic A · Onboard safely

- **A1 — Give consent before upload**
  _As any user, I want to see exactly what happens to my PDF before I drop it,
  so I can decide whether to continue._
  **Acceptance:** Consent modal blocks `/app/*`. Required items pre-checked
  and locked; optional items default unchecked. Decline → public landing.
  Accept → write `consent_v1` to localStorage + cookie, route to `/sign-in`.

- **A2 — Sign in (demo auth)**
  _As any user, I want a quick login so my contracts are tied to me alone._
  **Acceptance:** Magic-link form auto-submits in demo mode (any email
  works). After submit, route to `/app/upload`. Auth cookie required for
  every `/app/*` route.

## Epic B · Upload and process

- **B1 — Upload a PDF**
  _As Maria (P1), I want to drop my PDF and start the check in one action._
  **Acceptance:** Drag-and-drop or click-to-browse. PDF only, max 25 MB
  (validated client-side via `uploadValidation.ts`). Invalid file → inline
  error, no upload attempted.

- **B2 — Watch progress**
  _As any user, I want to see the analysis is making progress so I don't
  refresh._
  **Acceptance:** Progress bar + 4-step timeline (OCR → segmentation → law
  cross-check → summary). One step pulses as "now". Cancel button stops
  processing and returns to upload.

- **B3 — Find a recent contract**
  _As Eva (P3), I want to re-open contracts I've already analyzed without
  re-uploading._
  **Acceptance:** Recent contracts list on `/app/upload` shows filename,
  age, and severity counts (▲ ◐ ◌). Clicking opens that contract's results.

## Epic C · Read the results

- **C1 — See the headline**
  _As Maria (P1), I want a one-glance summary of how risky this contract is._
  **Acceptance:** Risk rail shows counts per severity at the top of the
  results screen. The most critical card is auto-expanded; everything else
  is collapsed.

- **C2 — Jump to a specific risk**
  _As Tom (P4), I want to navigate straight to the clauses I care about._
  **Acceptance:** Each row in the rail scrolls **both** PDF and simplified
  panes to the matching clause. Active row gets `aria-current="true"`.
  Filter checkboxes hide/show severities (Critical / Medium / Low / OK).

- **C3 — See the risky text in the original**
  _As any user, I want to verify the AI is pointing to the actual clause —
  not paraphrasing._
  **Acceptance:** PDF pane renders the real document with inline `<mark>`
  highlights drawn from OCR bounding boxes. Each highlight has a margin
  glyph (▲ ◐ ◌) so it works in grayscale.

- **C4 — Read the simplified explanation**
  _As Maria (P1), I want the legalese rewritten so I actually understand it._
  **Acceptance:** Right pane shows a card per finding: severity badge, plain
  summary, "what to do" bullets, and two CTAs (Why? · Show law).

- **C5 — Switch the reading level**
  _As Tom (P4) reviewing the same contract Maria signed, I want statute-grade
  detail without re-uploading._
  **Acceptance:** Profile pills (P1–P4) re-render only the right pane and
  the Why drawer. Zero network calls (verified in DevTools). The PDF pane
  and rail are untouched.

## Epic D · Trust the verdict

- **D1 — Understand "why is this a risk?"**
  _As Maria (P1), I want to know why the AI flagged this clause — and that
  a real law backs it up._
  **Acceptance:** "Why?" opens a side drawer with the rationale, the cited
  statute (e.g. BW 7:652), and links to read the original Dutch text or a
  plain-language version. Reading level matches the active profile.

- **D2 — Read the law text**
  _As Tom (P4), I want the statute itself, not someone's summary of it._
  **Acceptance:** "Show law" opens a modal with the unedited source text and
  a permanent link.

## Epic E · Three scenarios

- **E1 — All clear (best case)**
  _As Eva (P3), if my contract is clean I want the app to say so plainly,
  not invent risks._
  **Acceptance:** When 0 findings, the right pane shows a single green
  "All clear · You can sign with confidence" card. No collapsed risk cards
  beyond the OK section. Footer keeps "Save report".

- **E2 — Worth reviewing (medium)**
  _As Joren (P2), if there are only medium concerns, I want help deciding
  whether to negotiate or accept._
  **Acceptance:** Right pane leads with "Worth reviewing", followed by
  one card per medium/low finding with negotiation hints. No blocking
  banner.

- **E3 — Critical, human-in-the-loop (worst case)**
  _As Maria (P1), if something is illegal I want the app to **stop me from
  signing** and connect me to a person._
  **Acceptance:** Top-of-screen STOP banner in critical color. Right pane
  leads with "Do not sign yet" and a Human-in-the-Loop card with two CTAs:
  "Connect me to legal aid →" (primary) and "I'll handle this myself".
  Share button gets a warning chip and danger styling.

## Epic F · Compare

- **F1 — Compare two offers**
  _As Eva (P3), I want to compare an offer with a counter-offer and see
  exactly which clauses got better or worse._
  **Acceptance:** `/app/compare/:a/:b` shows merged risk rail with diff
  arrows (▲ → ✓, ◐ → ◌, etc) plus dual PDF panes. Selecting a row scrolls
  both PDFs to the matching clause. Footer shows a verdict ("B is safer in
  3 of 4 risks") and a downloadable comparison report.

## Epic G · Share & download

- **G1 — Download a simplified PDF**
  _As Maria (P1), I want to print or save the easy-read version._
  **Acceptance:** Footer button generates a PDF with the simplified pane
  content + severity badges + sources. Filename: `<original>-summary.pdf`.

- **G2 — Download contract + notes (TXT)**
  _As Tom (P4), I want a single text file containing the original clauses
  and the explanations side-by-side, for archiving._
  **Acceptance:** TXT export contains every risk in clause order with
  `ORIGINAL · EXPLANATION (severity) · SOURCE` blocks. Generated server-side
  from the same fixture as the UI; snapshot-tested in CI.

- **G3 — Share a simplified link**
  _As Joren (P2), I want to send the summary to my parent without exposing
  the full contract._
  **Acceptance:** Share dialog defaults to "Simplified summary only".
  Generates `/app/share/:token` (read-only, simplified pane only).
  Optional: require recipient sign-in, expiry (1h / 24h / 7d / never).
  When critical findings exist, a warning chip is shown and recipients see
  the same severity badge.

## Epic H · Accessibility & guardrails

- **H1 — Color-blind safe severity**
  _As a deuteranopic user, I want to tell critical from medium without
  relying on color._
  **Acceptance:** Every severity uses **icon + label + color** (▲ ◐ ◌ ✓).
  `axe-core` reports zero contrast issues on every results scenario.

- **H2 — Keyboard navigation**
  _As a screen-reader user, I want to tab through the results in reading
  order._
  **Acceptance:** Tab order: rail → PDF → simplified → footer. Active rail
  row syncs `aria-current`. Why drawer is a focus trap with `Esc` to close.

- **H3 — Consent guard**
  _As a privacy-conscious user, I never want my PDF to leave my browser
  before I've consented._
  **Acceptance:** Missing `consent_v1` redirects from any `/app/*` to
  `/consent`. Missing auth cookie redirects to `/sign-in`. Both checks are
  server-side in `middleware.ts`.

---

## Story → wireframe map

| Story | Wireframe(s)               |
| ----- | -------------------------- |
| A1    | §1 Consent                 |
| A2    | §2 Sign-in                 |
| B1    | §4 Upload                  |
| B2    | §5 Processing              |
| B3    | §4 Upload (Recent)         |
| C1–C4 | §6 Results main            |
| C5    | §3 App shell + §6 Results  |
| D1    | §8 Why drawer              |
| D2    | §6 (Law modal CTA)         |
| E1    | §7a Best                   |
| E2    | §7b Medium                 |
| E3    | §7c Critical               |
| F1    | §9 Compare                 |
| G1–G3 | §10 Share · §11 TXT export |
| H1–H3 | All scenarios + middleware |
