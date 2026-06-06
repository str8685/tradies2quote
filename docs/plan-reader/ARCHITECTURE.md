# AI Plan-Reader & Material Takeoff — Architecture

> **Status:** Design + Phase-1 scaffolding. Phases 2–7 (extraction/calculation
> internals) are **NOT** built yet and require explicit owner approval before
> starting — per the build brief ("stop and wait for approval before building
> extraction/calculation internals").
>
> **Product principle (from the brief):** The strongest version is _not_ "AI
> reads any plan perfectly." It is **"AI reads supported plan types, shows its
> work, calculates deterministically, and asks for review when it is not sure."**
> Accuracy + auditability beat full automation.

---

## 0. The one decision that shaped this design

The brief proposed a **Python FastAPI service + async queue + OpenCV/Tesseract**.
We are **not** doing that. The owner confirmed: **stay in Next.js 16 + Supabase**
(the existing single-Vercel-app deploy). Why:

1. **~60% already exists in TypeScript and works.** There is already a Claude-Opus
   vision scanner (`src/app/api/quotes/scan-drawing/route.ts`), a deterministic
   takeoff orchestrator with confidence gating (`src/lib/takeoff/`), and 9
   calculators (deck, cladding, framing, roofing, fencing, concrete, lining,
   insulation, fixing). A parallel Python system would **duplicate** all of it.
2. **Solo-maintainable.** A second service is another thing to host, secure, pay
   for, and keep in sync. CLAUDE.md: _"avoid adding dependencies unless absolutely
   necessary."_
3. **The brief allows it** — _"Use this stack unless the repo strongly suggests a
   better local pattern."_ It does.

So this design **extends the existing pipeline**. Every "new" capability below is
either a new layer _on top of_ `src/lib/takeoff/` or a new sibling module that
feeds into it. Nothing is rebuilt.

PDF rasterization happens **client-side via `pdfjs-dist`** (owner-confirmed): the
browser already holds the file, renders each page to a PNG in a worker, and
uploads page images — same pattern as the existing client-side HEIC→JPEG prep in
`ScanPanel`. No server canvas/native dependency.

---

## 1. What exists today vs. what this adds

| Capability | Today | This system adds |
|---|---|---|
| Vision read of a drawing | ✅ `scan-drawing` (Opus 4.7), `[T2Q_PLAN]` markers, deterministic geometry | Per-**sheet** extraction + persisted normalized JSON |
| Deterministic calculators | ✅ 9 scopes, formulas in code | **`foundation`** scope (slab/footing/mesh) |
| Confidence + review gating | ✅ `TakeoffStatus`, `ClarificationQuestion(blocking)`, per-line `confidence`, `EvaluatorVerdict` | **Sheet-level** gates: classification, scale, OCR, geometry-completeness, text-vs-geometry mismatch |
| File ingestion | ❌ images discarded after scan | **Persisted** originals + page images, `plan_files`/`plan_sheets` tables |
| Multipage PDF | ❌ single image only | **Client split** → one image per page |
| Sheet classification | ❌ user picks a job type | **Classifier**: deck / floor-plan / foundation / elevation / section / schedule / unknown + confidence |
| Foundation discipline | ❌ none | extractor + calculator |
| Review overlay UI | ❌ dimensions textarea only | highlighted detected-region inspector + correction loop |

---

## 2. Pipeline (end-to-end)

```
                         ┌─────────── CLIENT (browser) ───────────┐
  upload PDF/PNG/JPG ──▶ │  pdfSplit.client.ts  (pdfjs-dist)       │
                         │  multipage PDF → 1 PNG per page         │
                         │  HEIC→JPEG / downscale (existing prep)  │
                         └──────────────────┬──────────────────────┘
                                            │  page images + metadata
                                            ▼
  POST /api/plans/ingest ───────────────────────────────────────────────────
   1. persist original   → Storage  plan-uploads/{user}/{file}/original.*
   2. persist page imgs  → Storage  plan-uploads/{user}/{file}/p{n}.png
   3. insert plan_files row + N plan_sheets rows  (RLS: user_id=auth.uid())
                                            │
                                            ▼
  POST /api/plans/{fileId}/classify  ── PHASE 1 ──────────────────────────────
   classify.ts:  filename hints + title-block OCR text + vision features
   → each sheet: { sheet_type, classification_confidence }
   LOW confidence / unknown  → sheet.review_required = true, STOP (no extract)
                                            │  (only known, confident sheets continue)
                                            ▼
  POST /api/plans/{fileId}/extract  ── PHASE 2–3 (NOT BUILT) ─────────────────
   per sheet_type:  deck_extractor | layout_extractor | foundation_extractor
   → title-block, scale+units, dimensions, notes, symbols, geometry
   → normalized ExtractedSheet JSON (persisted to plan_sheets.extraction)
   GATES: scale? OCR conf? geometry complete? text↔geometry agree?
                                            │
                                            ▼
  takeoff orchestrator  ── PHASE 4 (extends existing) ───────────────────────
   ExtractedSheet → ExtractedExtraction → calculators/{scope}.ts
   (reuses src/lib/takeoff: LineBasis, TakeoffStatus, EvaluatorVerdict)
   + NEW foundation calculator
                                            │
                                            ▼
  Review UI  ── PHASE 5 ─────────────────────────────────────────────────────
   plan image + highlighted regions + editable dims + "rerun" → corrections
                                            │
                                            ▼
  Outputs  ── PHASE 6 ───────────────────────────────────────────────────────
   normalized JSON · takeoff summary · BOM · quote line items ·
   confidence report · review flags · (CSV/XLSX later)
```

**Hard rule encoded structurally:** an `unknown`/low-confidence sheet **never**
reaches an extractor, and an extractor that can't resolve scale/required
dimensions emits a `blocked` status + a `ClarificationQuestion` instead of a
number. Explicit failure over silent guessing.

---

## 3. Module / folder plan

```
src/lib/planreader/
├── schema.ts            [P1] normalized types: PlanFileRecord, PlanSheetRecord,
│                              SheetType, SheetClassification, ExtractedSheet,
│                              CalculationRecord  (+ zod-shaped validators)
├── classify.ts          [P1] sheet classifier: filename + title-block text
│                              heuristics (pure, tested) + vision classifier
├── storage.ts           [P1] Storage bucket name + path helpers (pure)
├── pdfSplit.client.ts   [P1] "use client" pdfjs-dist page→PNG splitter
├── ingest.ts            [P2] server data-access: insert file+sheet rows
│                              (built after migration is applied + types regen)
├── extractors/          [P2-3] one module per discipline (NOT built yet)
│   ├── deck.ts                 wraps existing scan-drawing extraction
│   ├── layout.ts               floor-plan: wall runs, openings, room areas
│   └── foundation.ts           slab outline, footings, mesh, reo
├── gates.ts             [P2] confidence gate functions (scale/ocr/geometry/…)
└── __tests__/
    └── classify.test.ts [P1] filename + title-block heuristic cases

src/lib/takeoff/
└── calculators/
    └── foundation.ts    [P4] NEW deterministic calculator (slab/footing/mesh)

src/app/api/plans/
├── ingest/route.ts            [P1*] POST: persist file + sheets
├── [fileId]/classify/route.ts [P1*] POST: classify each sheet
├── [fileId]/extract/route.ts  [P2]  POST: run extractor per known sheet
└── [fileId]/route.ts          [P5]  GET: full file+sheets+extraction for review UI

src/app/app/plans/             [P5] review UI (overlay + correction loop)

supabase/migrations/
└── 20260607_plan_reader_phase1.sql  [P1] plan_files + plan_sheets + RLS
                                            (WRITTEN, not applied — awaits approval)
```

`[P1]` = built now (scaffolding). `[P1*]` = phase-1 routes, written **after** the
migration is applied and `database.types.ts` is regenerated (so the typed
Supabase client knows the new tables). `[P2+]` = awaiting approval.

---

## 4. Normalized JSON schema (persisted)

Two persisted tables + one in-row JSON blob per sheet. TS source of truth lives in
`src/lib/planreader/schema.ts`.

### `plan_files` (one per upload)
```ts
PlanFileRecord {
  id: uuid
  user_id: uuid                 // RLS scope; never from client
  quote_id: uuid | null         // optional link to the quote being built
  project_id: string | null     // free-form grouping
  original_filename: string
  mime: string                  // application/pdf | image/png | image/jpeg
  byte_size: number
  page_count: number
  storage_path: string          // plan-uploads/{user}/{file}/original.*
  uploaded_at: timestamptz
  status: 'uploaded'|'classified'|'extracted'|'review'|'done'|'error'
}
```

### `plan_sheets` (one per page)
```ts
PlanSheetRecord {
  id: uuid
  file_id: uuid                 // → plan_files
  user_id: uuid                 // denormalized for RLS
  sheet_number: number          // 1-based page index
  sheet_label: string | null    // title-block sheet no. e.g. "A-101"
  image_path: string            // plan-uploads/{user}/{file}/p{n}.png

  // classification (Phase 1)
  sheet_type: SheetType         // deck|floor_plan|foundation|elevation|
                                // section_detail|schedule|unknown
  classification_confidence: number   // [0,1]
  classification_basis: string[]       // ['filename:deck', 'titleblock:FOUNDATION', 'vision:0.82']

  // extraction (Phase 2-3) — null until extracted
  extraction: ExtractedSheet | null    // JSONB blob, schema below

  review_required: boolean
  review_reasons: string[]      // human-readable gate failures
  status: 'classified'|'extracting'|'extracted'|'needs_review'|'blocked'|'done'
}
```

### `ExtractedSheet` (JSONB in `plan_sheets.extraction`)
Mirrors the brief's data model and bridges into the existing takeoff pipeline.
```ts
ExtractedSheet {
  units: 'mm'|'m'|'ft'|'in' | null
  scale_text: string | null            // "1:100", "1/4\"=1'-0\""
  scale_confidence: number             // [0,1]; 0 ⇒ cannot auto-measure pixels
  ocr_confidence: number               // [0,1] aggregate
  title_block: Record<string,string>   // project, sheet no, date, drawer…
  ocr_blocks: OcrBlock[]               // {text, bbox, confidence}
  dimensions: LabelledDimension[]      // {value_m, raw_text, bbox, source:'text'|'geometry'}
  detected_symbols: DetectedSymbol[]   // {kind, bbox, confidence}
  geometry: SheetGeometry              // polylines, closed areas, openings
  // → fed to the takeoff orchestrator:
  takeoff: TakeoffResult | null        // existing type from src/lib/takeoff/schemas.ts
  warnings: string[]
  review_required: boolean
}
```

### `CalculationRecord` (every quantity is auditable)
This is **not a new type** — it is the existing `TakeoffLine` from
`src/lib/takeoff/schemas.ts`, which already carries everything the brief
requires:

| Brief field | Existing `TakeoffLine` field |
|---|---|
| quantity_name | `name` |
| value / unit | `quantity` / `unit` |
| formula | `basis.formula` |
| inputs | `basis.inputs` |
| input_sources | `basis.assumed` (which inputs were defaults vs. confirmed) |
| waste_factor | in `basis.inputs` (per calculator) |
| rounded_to | `basis.stockNote` / formula text |
| confidence | `confidence` (0–1) |
| review_required | `status` ∈ {needs_review, blocked} |

We reuse it verbatim — formulas stay in code, never in prompts.

---

## 5. Confidence model (the heart of "ask for review when unsure")

Six independent signals per sheet, each in `[0,1]`. They do **not** average into a
single mushy score — each is a **gate** that can independently force
`review_required`. Thresholds are constants in `gates.ts` so they're tunable.

| Gate | Signal | Default threshold | If it fails |
|---|---|---|---|
| `classification` | classifier confidence | **0.65** | sheet stays `unknown`, **no extraction** |
| `scale` | scale text found + parsed | **0.5** | `scale_confidence=0` ⇒ **never** measure pixels; ask user to calibrate |
| `ocr` | mean OCR block confidence | **0.6** | dimensions flagged `needs_review` |
| `geometry_complete` | closed areas / wall runs resolve | boolean | missing geometry ⇒ `blocked` + clarification |
| `required_dims_present` | calculator's required inputs all present | boolean | `blocked` + `ClarificationQuestion(blocking:true)` |
| `text_vs_geometry` | labelled dim vs. measured dim agree within tol | **±5%** | surface BOTH, mark `needs_review`, never silently pick one |

**Roll-up rule** (reuses existing `worstStatus`):
- any gate ⇒ `blocked` → sheet status `blocked`, no number leaves.
- any gate ⇒ `needs_review` → sheet `needs_review`, number shown but flagged.
- a substituted default → `assumed`.
- all clear → `ok`.

The existing `EvaluatorVerdict` (advisory plausibility, `pass|caution|fail`) runs
**after** calculation as a final sanity net and can hard-block send on `fail` —
already wired in `src/lib/takeoff/`.

**Engineering rules from the brief, encoded:**
- _"If scale is missing, do not auto-measure from pixels unless the user
  calibrates"_ → `scale_confidence=0` blocks pixel measurement in `gates.ts`.
- _"If OCR conflicts with geometry, surface the conflict"_ → `text_vs_geometry`
  gate emits both values, never resolves silently.
- _"Prefer explicit failure over silent guessing"_ → no calculator runs without
  `required_dims_present`.

---

## 6. API design

| Method + path | Phase | Purpose |
|---|---|---|
| `POST /api/plans/ingest` | 1 | Body: page images (multipart) + `{original_filename, mime, byte_size, page_count, quote_id?}`. Persists original + page PNGs to Storage, inserts `plan_files` + N `plan_sheets`. Returns `{file_id, sheets:[{id,sheet_number,image_path}]}`. Auth + rate-limit + subscription gating (same pattern as `scan-drawing`). |
| `POST /api/plans/{fileId}/classify` | 1 | Classifies each sheet (filename + title-block text + vision). Writes `sheet_type`, `classification_confidence`, `classification_basis`, sets `review_required` for low-confidence/unknown. Returns the updated sheets. |
| `POST /api/plans/{fileId}/extract` | 2–3 | For each **confident, known** sheet: run the matching extractor, run gates, persist `extraction`. Skips `unknown`/blocked sheets. |
| `GET /api/plans/{fileId}` | 5 | Full file + sheets + extraction for the review UI. |
| `POST /api/plans/{fileId}/sheets/{sheetId}/correct` | 5 | User overrides sheet_type or dimensions → reruns gates + calculators. |

All routes: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60`,
auth via `createClient()` + `getUser()`, `consumeDailyQuota` rate-limit,
`canWrite` subscription check — identical to `scan-drawing/route.ts`.

---

## 7. Phased roadmap

| Phase | Scope | State |
|---|---|---|
| **1** | upload · client PDF split · page-image render · sheet **classifier** · DB records | **scaffolding now** |
| 2 | OCR text · title-block + scale parsing · dimension extraction · confidence gates | awaiting approval |
| 3 | geometry/symbol extraction for deck · layout · foundation | awaiting approval |
| 4 | deterministic calculators (incl. **new foundation**) · takeoff output | awaiting approval |
| 5 | review UI: image overlay · highlighted regions · correction loop · rerun | awaiting approval |
| 6 | export (BOM/CSV/XLSX) · pricing integration · supplier mapping | awaiting approval |
| 7 | active learning from user corrections (feeds `quote_edit_events` loop) | awaiting approval |

Phase 7 plugs into the **existing AI-eval loop** (`quote_edit_events`,
`ai_snapshot`, `src/lib/quoteEditDiff.ts`) — corrections become training signal
for prompt/threshold tuning, grounded in evidence not guessing.

---

## 8. Deterministic formulas (live in code, per discipline)

Illustrative — full set lands in Phase 4. Each emits a `TakeoffLine` with
`basis.formula` + `basis.inputs` + waste + rounding.

**Deck** (exists): board count = `ceil(width_m / cover_m) · (length_m/stock)`;
joists = `floor(length_m / spacing) + 1`; bearers, posts from support grid;
footing concrete = `posts · π·(d/2)²·depth`; fasteners from board×joist crossings.

**Layout / floor plan** (partly exists via `wall`): gross floor area; wall linear
m (total run, all segments); opening counts; room areas; lining/flooring from net
coverage.

**Foundation** (NEW): slab area = polygon area; slab concrete = `area · thickness`;
footing run = perimeter (+ internal); footing concrete = `run · w · d`; mesh
count = `ceil(area / sheet_cover · (1+lap_waste))`; reo from perimeter/grid rules.

**Configurable templates:** waste %, stock lengths, mesh sheet size, default
spacings are **estimating-template** values, not hardcoded constants — so they can
vary by region/supplier/business rule (brief requirement). Phase 4 reads them from
a per-user template (defaults baked in, owner-overridable).

---

## 9. Storage & data model notes

- **Bucket:** `plan-uploads` (private). Paths: `{user_id}/{file_id}/original.{ext}`
  and `{user_id}/{file_id}/p{n}.png`. Access via signed URLs only.
- **RLS:** `plan_files` and `plan_sheets` both scoped `user_id = auth.uid()`,
  `(select auth.uid())` form to avoid the initplan perf hit (matches the Wave-40
  RLS optimization already applied). Storage bucket policy scopes objects to
  `{user_id}/` prefix.
- **No deletion feature** (owner policy): rows/objects are not hard-deleted by the
  app; cleanup is manual. Matches the existing "no account-deletion" stance.

---

## 10. What is explicitly out / deferred

- No Python service, no separate queue infra (decided §0).
- No live supplier price scraping (MVP scope boundary, unchanged).
- No copyrighted manual ingestion (GIB/James Hardie/MiTek) — clean-room
  estimating rules only, per CLAUDE.md.
- Extraction/calculation internals (Phases 2–7) **not started** — this document +
  Phase-1 scaffolding is the checkpoint.
