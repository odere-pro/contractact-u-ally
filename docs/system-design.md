# System Design — contractact-u-ally

All diagrams are Mermaid (renders in GitHub / Markdown viewers).
Source of truth for the C4 model can later move to a Structurizr DSL workspace.

---

## 1. High-level (C4 Container)

```mermaid
flowchart LR
  subgraph Client["Browser (React 19 / Next.js App Router)"]
    UI["Landing page<br/>UploadZone + StageTracker + ClauseList"]
    HOOK["useAnalysisStream hook<br/>(NDJSON reader)"]
    LS[("localStorage<br/>summary only — never full text")]
  end

  subgraph Edge["Vercel Edge / CDN"]
    CSP["CSP + security headers<br/>(next.config.ts)"]
  end

  subgraph Server["Next.js Route Handlers (Node runtime, maxDuration 60s)"]
    OCR["/api/ocr<br/>multipart, MIME + magic-byte + 10MB"]
    AN["/api/analyze<br/>JSON in → NDJSON stream out"]
    RL["rateLimit (token bucket, per-IP)"]
    PIPE["runRiskPipeline<br/>classify → loadRules → stream"]
  end

  subgraph Domain["Domain layer (src/lib)"]
    CLS["catalog/classifier<br/>contract type detection"]
    RULES["catalog/ruleLoader<br/>data/labor-contracts/* +<br/>data/nl-labor-law.json"]
    PROMPT["pipeline/prompts<br/>system prompt + risk examples"]
    SCHEMA["catalog/schemas<br/>zod validation of stream events"]
  end

  subgraph External["External providers"]
    MIST["Mistral OCR API<br/>(PDF → text)"]
    ANTH["Anthropic API<br/>claude-sonnet-4-6 streaming"]
  end

  UI -->|PDF upload| Edge --> OCR
  HOOK -->|POST ocrText + jurisdiction| Edge --> AN
  OCR --> RL
  AN --> RL
  OCR --> MIST
  AN --> PIPE
  PIPE --> CLS --> RULES
  PIPE --> PROMPT
  PIPE -->|messages.stream| ANTH
  PIPE --> SCHEMA
  HOOK -->|render clauses| UI
  UI -.summary only.-> LS
```

**Key constraints**

- No database. No persistence of contract content. `localStorage` holds only
  the rendered summary so a refresh keeps results.
- Provider keys (`MISTRAL_API_KEY`, `ANTHROPIC_API_KEY`) are server-only.
- Both routes are rate-limited (5 req / 60s per IP, token bucket).

---

## 2. Processing algorithm (how a contract is analyzed)

```mermaid
flowchart TD
  A[User drops PDF in UploadZone] --> B{Client validation<br/>MIME + magic bytes + size}
  B -- fail --> B1[Show inline error<br/>no network call]
  B -- ok --> C[POST multipart → /api/ocr]

  C --> D{Server validation<br/>rateLimit + MIME + size + magic}
  D -- fail --> D1[4xx JSON error<br/>no echo of input]
  D -- ok --> E[runMistralOcr<br/>PDF bytes → plain text + pages]

  E --> F[Client receives ocrText]
  F --> G[POST JSON → /api/analyze<br/>ocrText + jurisdiction + typeId?]

  G --> H[runRiskPipeline orchestrator]

  H --> H1[Stage: classify<br/>emit progress 0]
  H1 --> H2[classifyContract<br/>heuristic + keywords]
  H2 --> H3[Stage: classify progress 1]

  H3 --> I1[Stage: load_rules progress 0]
  I1 --> I2[loadRulesForType<br/>read jurisdiction laws + contract rules]
  I2 --> I3[Stage: load_rules progress 1]

  I3 --> J1[Stage: analyze progress 0]
  J1 --> J2[Build system prompt:<br/>contract type + rule set + risk examples]
  J2 --> J3[Anthropic messages.stream<br/>claude-sonnet-4-6, max 8192 tokens]

  J3 --> K[For each text_delta:<br/>buffer until newline → JSON.parse line]
  K --> L{Validate with zod<br/>clauseEventSchema or summaryEventSchema}
  L -- clause --> L1[Encode NDJSON clause event<br/>flush to client]
  L -- summary --> L2[Encode NDJSON summary event<br/>flush to client]
  L -- invalid --> L3[Drop line silently<br/>do not break stream]

  L1 --> K
  L2 --> M[Stage: analyze progress 1<br/>close stream]
  L3 --> K

  M --> N[Client useAnalysisStream<br/>renders ClauseList + Summary]
  N --> O[Persist summary to localStorage]
```

**Why streaming end-to-end**

- Worker sees clauses appear as soon as Claude emits them — perceived latency
  matters more than total wall clock.
- NDJSON (one JSON object per line) is trivially parseable in the browser
  without a streaming JSON parser.
- zod validation per-line means a corrupted line cannot poison the UI; it is
  dropped, the next line still renders.

**Failure modes**
| Stage | Failure | Behavior |
|---|---|---|
| Upload | Wrong MIME / oversized | 4xx JSON, never echo filename |
| OCR | Mistral 5xx / timeout | 5xx surfaced to client, no retry-storm |
| Classify | Unknown contract type | Falls back to generic ruleset |
| Stream | Anthropic disconnect | Stream closes; partial clauses remain rendered |
| Validation | Malformed JSON line | Line dropped, stream continues |

---

## 3. Request path — sequence diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Worker (browser)
  participant UI as page.tsx + UploadZone
  participant H as useAnalysisStream
  participant E as Vercel Edge
  participant O as /api/ocr
  participant A as /api/analyze
  participant P as runRiskPipeline
  participant C as classifier + ruleLoader
  participant M as Mistral OCR
  participant K as Anthropic Claude

  U->>UI: drop PDF
  UI->>UI: validateUpload (MIME + magic + size)
  UI->>E: POST /api/ocr (multipart)
  E->>O: forward (CSP, headers)
  O->>O: rateLimit + re-validate
  O->>M: POST PDF bytes
  M-->>O: { text, pages }
  O-->>UI: 200 { text, pages, durationMs }

  UI->>H: start({ ocrText, jurisdiction })
  H->>E: POST /api/analyze (JSON)
  E->>A: forward
  A->>A: rateLimit + zod parse body
  A->>P: runRiskPipeline(...)
  P-->>H: stage classify(0)
  P->>C: classifyContract(text)
  C-->>P: { typeId, confidence }
  P-->>H: stage classify(1)

  P-->>H: stage load_rules(0)
  P->>C: loadRulesForType(typeId, jurisdiction)
  C-->>P: LoadedRuleSet
  P-->>H: stage load_rules(1)

  P-->>H: stage analyze(0)
  P->>K: messages.stream(system, user)
  loop for each text_delta
    K-->>P: delta
    P->>P: buffer → split on \n
    P->>P: zod validate line
    alt clause event
      P-->>H: NDJSON clause
      H-->>UI: append clause
    else summary event
      P-->>H: NDJSON summary
      H-->>UI: render summary
    else invalid
      P->>P: drop
    end
  end
  K-->>P: stream end
  P-->>H: stage analyze(1)
  P-->>H: close
  UI->>UI: persist summary to localStorage
  UI-->>U: report visible (< 60s target)
```

---

## 4. Notes for the next iteration

- **C4 layers not yet drawn:** Component diagram for `src/lib/catalog/*` and a
  Deployment diagram (Vercel Functions + provider regions).
- **Observability:** add structured server logs (no PII) — request id, stage,
  duration, provider latency. Stream events already include progress markers
  that can double as client-side timing breadcrumbs.
- **Resilience:** wrap Anthropic call in a single retry on transient network
  errors only — never on 4xx. Today the pipeline relies on the client to
  retry the whole `/api/analyze` call.
- **Caching:** OCR text for identical PDF hashes could be cached per session
  in memory only (no disk). Out of scope until the rule engine stabilizes.
