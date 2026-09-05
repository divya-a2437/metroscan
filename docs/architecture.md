# MetroScan — Architecture

## System Overview

MetroScan is a browser-based decision-support prototype with a server-side
Gemini extraction route for screening packaged-commodity labels against a subset of declaration
requirements relevant to India's Legal Metrology (Packaged Commodities)
framework. It is built for the SIH prototype timeline (3–4 days) and is
explicitly **not** a production compliance system: it has no backend, no
database, and no legally binding output. Every result requires human
verification by a qualified inspector.

The system's key design principle: **AI/OCR only extracts data; a
deterministic, explainable rule engine makes every PASS/FAIL/REVIEW
decision.** No AI/LLM is ever asked "is this compliant?" — that
determination is always computed by plain TypeScript logic operating on
structured data.

## High-Level Architecture

```mermaid
flowchart TD
    A[Package Images] --> B[Image Upload<br/>ImageUploader.tsx]
    B --> C[Gemini Extraction<br/>app/api/extract/route.ts]
    C --> D[Declaration Normalization]
    D --> E[Product Declaration<br/>ProductDeclaration]
    E --> F[Compliance Rule Engine<br/>lib/rules]
    F --> G[Compliance Report<br/>ComplianceReport]
    G --> H[Evidence + Inspection Summary<br/>CompliancePanel.tsx]
    H --> I[Human Verification]
```

The Gemini API key is read only by the server-side route and is never sent to
the browser. The compliance rule engine remains deterministic and does not
ask Gemini to make legal decisions.

## Component Architecture
```text
metroscan/
├── app/
│ ├── page.tsx — landing page ("Start Scan")
│ ├── layout.tsx — root layout, fonts, <Header/>
│ ├── globals.css — Tailwind v4 @theme tokens (color, font)
│ └── scanner/page.tsx — the entire scanner workflow + page state
├── components/
│ ├── layout/Header.tsx — top nav bar
│ └── scanner/
│ ├── ImageUploader.tsx — upload, preview, role assignment, remove
│ ├── OCRResults.tsx — per-image OCR status/text/confidence
│ ├── DeclarationPanel.tsx — extracted ProductDeclaration display
│ ├── CompliancePanel.tsx — compliance report, evidence, summary
│ └── PipelineStatus.tsx — 5-stage inspection pipeline indicator (Capture/OCR/Extract/Screen/Verify), derived from real app state
└── lib/
├── ocr.ts — Tesseract worker lifecycle + recognizeImage()
├── extraction/
│ ├── schema.ts — ProductDeclaration, FieldEvidence, OcrChunk types
│ ├── normalize.ts — unit/number normalization helpers
│ └── deterministicExtractor.ts — regex/keyword extraction (no AI)
├── rules/
│ ├── types.ts — RuleResult, ComplianceReport types
│ ├── packagedCommodityRules.ts — the 7 prototype rules
│ └── evaluateCompliance.ts — runs all rules, aggregates summary
└── inspection.ts — inspection ID generation, clipboard text builder
│
└── README.md
    └── Project documentation
```


All state lives in `app/scanner/page.tsx` (React `useState`); no global
state manager, no server state. This is a deliberate scope decision for a
3–4 day prototype.

## Data Flow

1. **Upload** — `ImageUploader` holds `UploadedImage[]` (file, preview URL,
   role) in page state.
2. **Gemini extraction** — clicking "Extract with Gemini" sends all images
  and their roles to `app/api/extract/route.ts`, updating per-image status
  (`WAITING → PROCESSING → COMPLETE/ERROR`).
3. **Normalization** — the route validates Gemini's JSON response and returns
  a `ProductDeclaration` with 15 fields, each carrying `value`, `confidence`,
  and `evidence` (raw supporting line, source image, source role).
4. **Rule Engine** — `evaluateCompliance()` runs 7 deterministic rule
   functions against the `ProductDeclaration`, producing a
   `ComplianceReport` (per-rule `RuleResult[]` + summary counts + overall
   status).
5. **Evidence & Summary** — `CompliancePanel` renders the report, an
   "Issues Requiring Attention" triage list, and an `InspectionMeta`
   (client-generated ID + timestamp + image count) with a
   "Copy Inspection Summary" clipboard action.

## OCR Layer (`lib/ocr.ts`)

- Single module-level singleton Tesseract worker — never more than one
  worker instance at a time.
- Worker created lazily on first "Run OCR" click, not on page load.
- Terminated via `useEffect` cleanup when the scanner page unmounts.
- Runs entirely client-side; no server-side OCR, no Python.

## Extraction Layer (`lib/extraction/`)

- Fully deterministic: regex + keyword line-matching, no AI/LLM call.
- **Same-line matching first**: every field pattern is tried against a
  single OCR line before anything else — this is the original, fastest
  path and is unchanged for any input where label and value already
  appear together on one line.
- **Contextual fallback (net quantity, MRP, dates only)**: real-world OCR
  frequently splits a label and its value across 2–3 adjacent lines, and
  sometimes reports the value *before* the label. When same-line matching
  fails, these three fields fall back to a bounded ±3-line window search
  (`findFirstMatchContextual`), restricted to lines from the same source
  image, tried in both forward and reversed line order. This lets the
  same strict regex match either arrangement without loosening what it
  requires.
- **Combined "MFD & USE BY" handling**: when both keywords appear together
  followed by exactly two dates, the first date is assigned to
  `manufacturing_date` and the second to `use_by`, following the order
  stated by the label itself — never guessed when only one date is found.
- **Noise tolerance**: net-quantity and MRP keyword-to-number gaps were
  widened (net quantity: generic lazy gap; MRP: 15→25 char cap) to bridge
  garbled OCR fragments between a label and its value, while still
  requiring the number+unit (or currency) pattern to match — a stray
  digit with no unit after it is skipped, not captured.
- Every extracted field still preserves its evidence (raw OCR
  text — now potentially a joined multi-line window when the contextual
  fallback was used — source image, source role, OCR confidence). No
  fabricated evidence or confidence is introduced by the fallback path.
- **Known limitation**: the product-name heuristic (first qualifying line
  on the front image) is unchanged by this work and can still pick a
  marketing-text line over the actual brand name on noisy front labels.
  Not fixed — out of scope for the extraction-context update.
- Verified via temporary local scripts (not part of the committed test
  suite — no test framework exists in this repo) against real noisy OCR
  text; not verified against live browser OCR output.

## Rule Engine (`lib/rules/`)

- See `compliance-engine.md` for the full rule-by-rule specification.
- Pure functions: `(declaration: ProductDeclaration) => RuleResult`. No
  dependency on OCR, extraction internals, or any UI component.

## UI Layer

- Next.js App Router, Tailwind CSS v4 (`@theme` tokens in `globals.css`,
  no `tailwind.config.ts`), Inter + IBM Plex Mono, restrained
  off-white/charcoal palette with green/amber/red/gray reserved strictly
  for status meaning.

## Inspection Evidence Layer (`lib/inspection.ts` + `CompliancePanel.tsx`)

- Client-side-only `InspectionMeta` (ID + ISO timestamp + image count),
  generated once per completed run — not persisted anywhere.
- "Issues Requiring Attention" filters the report to FAIL/REVIEW only.
- Each rule result renders as an expandable `<details>` element; FAIL/REVIEW
  rows are open by default and carry a colored left border for visual
  prominence, PASS/NOT_CHECKED rows are collapsed by default.

## Current Client-Side Architecture

No backend. No database. No authentication. Nothing is persisted between
page loads — refreshing the browser clears all state by design. This is
appropriate for a live demo but not for real inspection record-keeping.

## Future Backend Architecture (not built — reference only)

If MetroScan moved beyond prototype stage, a natural next architecture
would add (in rough priority order): a persistence layer (Postgres/Supabase)
for `inspections`, `inspection_images`, `extracted_declarations`,
`compliance_checks`, and `reports` tables; PDF report generation from the
existing `ComplianceReport` shape; bounding-box evidence (tying OCR word
boxes to declaration fields for on-image highlighting); and an
AI-assisted extractor as an alternative to the deterministic one, kept
behind the same interface so the rule engine never changes. None of this
exists today — it is listed here only to show the current architecture
was designed with these extension points in mind.