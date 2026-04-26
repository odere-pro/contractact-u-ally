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
