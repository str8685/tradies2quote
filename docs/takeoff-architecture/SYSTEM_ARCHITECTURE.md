# Tradies2Quote — Specialist-Agent Construction Takeoff: System Architecture

**Status:** Architecture / design — preview & dev only. No production change is implied by this document.
**Scope:** The end-to-end "scan a drawing → classify → measure → quantify → review quote" pipeline.
**Audience:** Whoever builds the next phase. Read this before touching `src/lib/planreader/*` or `src/lib/takeoff/*`.

Companion docs (already in the repo — this doc sits *above* them and ties them together):
- `docs/plan-reader/ARCHITECTURE.md` — the multi-sheet plan-reader design.
- `docs/plan-reader/REVIEW_UI_CONTRACT.md`, `REVIEW_SCREEN_SPEC.md`, `PHASE4_WIRING.md`, `ROLLOUT.md`.
- `docs/takeoff-review-recovery.md` — required inputs per line type + the blocked-line recovery UX.

---

## 0. The one thing to understand first

This is **not** "one AI prompt reads any plan." It is a pipeline of **narrow, single-responsibility stages**, where:

- **The LLM/vision model only ever *reads*** — it transcribes labels, dimension strings, shapes, and a sheet-type vote. It is told to emit `null` for anything it cannot read, and it is **forbidden from producing quantities**.
- **Deterministic code does every calculation** — geometry maths (`src/lib/takeoff/geometry.ts`) and per-trade calculators (`src/lib/takeoff/calculators/*`). Same inputs → same numbers, every time, unit-tested.
- **Gates sit between read and calculate** — six independent confidence gates (`src/lib/planreader/gates.ts`) that can each *block* on their own. A high score on one signal never masks a failure on another.
- **Uncertainty becomes a question or a blocked line, never a guessed number.**

Most of this already exists in the codebase. This document's job is to (a) name which existing module plays each specialist-agent role, (b) draw the MCP host/tool-server boundaries over them, (c) spec the **one missing layer (CSI/MasterFormat trade-mapping)**, and (d) give an honest roadmap and risk list.

---

## 1. Honest current-state map

What the request asks me to "design" is, in large part, **already built**. Being specific about that is the whole point — anything else would be fluff.

| Requested specialist agent | Already exists? | Concrete module(s) |
|---|---|---|
| **A. Orchestrator / host** | ✅ Two of them | `src/lib/takeoff/orchestrator.ts` (`runTakeoff` / `runTakeoffWithExtraction`); the API host `src/app/api/quotes/generate/route.ts`. Plan-reader host: `src/app/api/plans/{ingest,classify,extract}/route.ts`. |
| **1. Document intake** | ✅ | `src/lib/planreader/ingest.ts`, `pdfSplit.client.ts` (client-side page split), `storage.ts`, `titleBlock.ts`. |
| **2. Sheet classification** | ✅ | `src/lib/planreader/classify.ts` → `SheetClassification {sheet_type, confidence, basis[]}`; gate in `gates.ts`. Free-text/voice path: `src/lib/takeoff/scope-router.ts` (`routeScope`) + `src/lib/aiTakeoffParser.ts` (`detectTakeoffType`). |
| **3. OCR + layout** | ✅ (partial) | `src/lib/planreader/extract.ts`, `scale.ts`; `OcrBlock {text, bbox, confidence}` + `BBox` (normalized [0,1]) in `planreader/schema.ts`. *bbox is null in the text-only Phase-2 path — coordinates land with the geometry phase.* |
| **4. Geometry / vision** | ✅ (deck/floor/foundation) | `src/lib/takeoff/geometry.ts` (`computePlanGeometry`, region-sum for L/T/U/stepped footprints, primitive shapes). Vision read happens in `src/app/api/quotes/scan-drawing/route.ts`. |
| **5. Deterministic calculators** | ✅ | `src/lib/takeoff/calculators/{deck,framing,lining,insulation,concrete,cladding,roofing,fencing,fixing,generic}.ts`; foundation: `src/lib/takeoff/foundationCalculator.ts` + `foundationAdapter.ts`. **Zero pricing logic inside.** |
| **6. CSI / trade-mapping** | ❌ **GAP** | None. `grep -rniE "masterformat|csi|division 0[0-9]"` returns nothing. **This is the layer this doc specs in §5.** |
| **7. Review / clarification** | ✅ | `src/lib/takeoff/clarify.ts` (`buildClarifications`), `validate.ts`, `evaluate.ts`, `explain.ts`; blocked-line UX in `src/lib/takeoff/blockedLineGuide.ts` + `docs/takeoff-review-recovery.md`. |
| **Scope-family safety guard** | ✅ (new) | `src/lib/takeoff/scopeFamily.ts` — strips deck-only material families from non-deck quotes (defense-in-depth against wrong-scope leakage). |
| **Confidence / evaluator** | ✅ | `EvaluatorVerdict {status: pass\|caution\|fail, reasons[], confidence}` in `schemas.ts`; six gates + thresholds in `planreader/gates.ts`. |
| **Send-gate safety** | ✅ | `src/lib/quote-validation.ts` (`assessQuoteTakeoffSafety`, `validateQuoteForSending`). |

**So the real work is not "build a takeoff system from scratch."** It is:
1. **Wire** `planreader` (multi-sheet drawing sets) into the `takeoff` orchestrator as a first-class input path (today the live scan path is single-image via `scan-drawing`).
2. **Add the CSI/MasterFormat mapping layer** (§5) — the only wholly-missing piece.
3. **Harden the boundaries** into MCP-style tool-servers (§4) so each stage sees only what it needs and can later move remote.
4. **Stand up the eval gates** (§7) so scope expansion is evidence-gated, including a **wrong-scope leakage** metric.

---

## 2. End-to-end architecture

```
                          ┌─────────────────────────────────────────────────────────┐
                          │  HOST / ORCHESTRATOR                                      │
                          │  takeoff/orchestrator.ts  +  api/quotes/generate          │
                          │  + api/plans/* (multi-sheet host)                         │
                          │                                                           │
   upload / scan / voice  │   owns: job state, security boundary, what reaches Review │
   ───────────────────────▶   never calculates; never reads pixels itself            │
                          └───────┬───────────────┬───────────────┬──────────────────┘
                                  │               │               │
              (tool call)         │               │               │     (tool call)
                                  ▼               ▼               ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ 1 INTAKE     │  │ 2 CLASSIFY   │  │ 3 OCR/LAYOUT │  │ 4 GEOMETRY   │
        │ planreader/  │  │ planreader/  │  │ planreader/  │  │ takeoff/     │
        │ ingest,split │  │ classify     │  │ extract,scale│  │ geometry     │
        │              │  │ scope-router │  │ titleBlock   │  │ (vision read │
        │ → PlanFile   │  │ → Sheet      │  │ → OcrBlock[] │  │  in scan rt) │
        │   Sheet[]    │  │   Classif.   │  │   Extracted  │  │ → Plan       │
        │              │  │              │  │   Sheet      │  │   Geometry   │
        └──────────────┘  └──────┬───────┘  └──────────────┘  └──────┬───────┘
                                 │  ┌─────────────────────────────────┘
                                 ▼  ▼
                          ╔══════════════════╗   ANY gate fails → review/block,
                          ║  GATES (×6)      ║   never a guessed number.
                          ║ planreader/gates ║   classification · scale · ocr ·
                          ╚════════┬═════════╝   geometry_completeness ·
                                   │             required_dims_present · text_vs_geometry
                       pass ───────┤────────── fail
                                   ▼                         ▼
                  ┌────────────────────────┐       ┌────────────────────────┐
                  │ 5 CALCULATORS          │       │ 7 REVIEW / CLARIFY     │
                  │ takeoff/calculators/*  │       │ takeoff/clarify,validate│
                  │ foundationCalculator   │       │ blockedLineGuide        │
                  │ → TakeoffLine[]        │       │ → ClarificationQuestion │
                  │   (quantity-only)      │       │   + blocked TakeoffLine │
                  └───────────┬────────────┘       └───────────┬────────────┘
                              │                                 │
                              ▼                                 │
                  ┌────────────────────────┐                   │
                  │ SCOPE-FAMILY GUARD     │                   │
                  │ takeoff/scopeFamily.ts │  deck materials    │
                  │ strips wrong-scope     │  can't leak into   │
                  │ material families      │  a wall quote      │
                  └───────────┬────────────┘                   │
                              ▼                                 │
                  ┌────────────────────────┐                   │
                  │ 6 CSI MAPPING  ❰NEW❱   │                   │
                  │ takeoff/csi/*          │                   │
                  │ → CsiLineItem[]        │                   │
                  │   (Division + trade)   │                   │
                  └───────────┬────────────┘                   │
                              └───────────────┬─────────────────┘
                                              ▼
                          ┌───────────────────────────────────────┐
                          │  REVIEW QUOTE  (quote_data.line_items) │
                          │  takeoff_status: ok/assumed/            │
                          │  needs_review/blocked                   │
                          │  PRICES_OFF=true → quantity-first,      │
                          │  manual pricing only                    │
                          └───────────────────────────────────────┘
```

**Invariants the host enforces (all already true in code, keep them true):**
- The host **merges** structured outputs; it does not interpret pixels or do maths.
- A stage's output is **typed and validated** before the next stage sees it (`parse*` helpers in `schemas.ts` / `planreader/schema.ts`).
- The model is in stages **2, 3, 4 only** (read/transcribe/vote). Stages **5, 6, 7 are pure code.**
- Nothing reaches Review without passing through the gates *or* being explicitly tagged `needs_review` / `blocked`.

---

## 3. Specialist agents — exact responsibilities & contracts

Each agent below lists: **owns / must-not / input → output / failure behaviour / current module**. "Agent" here means an isolated stage with a narrow tool surface (§4), not necessarily an LLM call — most are pure code.

### 3.1 Document Intake Agent — `planreader/ingest.ts`, `pdfSplit.client.ts`, `storage.ts`, `titleBlock.ts`
- **Owns:** accept upload (PDF/image), normalize, split a set into pages, persist each page image, extract file metadata (page count, byte size, mime), read the title block for sheet labels.
- **Must not:** classify, measure, or interpret content. Splitting is mechanical.
- **In → out:** uploaded bytes → `PlanFileRecord` + `PlanSheetRecord[]` (one per page).
- **Failure:** unreadable/oversized file → `status:"error"` with a reason; never a partial silent success. (`MAX_SCAN_UPLOAD_BYTES`, mime sniffing already enforced in `scan-drawing/route.ts` and `imageUpload.ts`.)
- **Security:** writes to per-user storage paths; `user_id` always from `auth.getUser()`, never the client.

### 3.2 Sheet Classification Agent — `planreader/classify.ts` (+ `scope-router.ts` / `detectTakeoffType` for text)
- **Owns:** decide each sheet's `SheetType` (`deck | floor_plan | foundation | elevation | section_detail | schedule | unknown`) **with a confidence and an evidence list**.
- **Must not:** one-keyword guessing. Classification is a **vote across independent signals** — filename, title-block text, vision — each recorded in `basis[]` (e.g. `["filename:deck", "titleblock:FOUNDATION PLAN", "vision:0.82"]`).
- **In → out:** sheet image + filename + title-block text → `SheetClassification {sheet_type, confidence, basis[]}`.
- **Gate:** `GATE_THRESHOLDS.classification = 0.65`. Below it, or `unknown` / unsupported type → the sheet is **labelled and skipped**, never force-fed to an extractor (`isSupportedSheetType`).
- **Hard rule already enforced in the voice/text path:** `detectTakeoffType` honours an authoritative `Job type:` line and an explicit `[T2Q_PLAN] type=` marker *before* any keyword fallback, and a deck/wall-ambiguous prose returns `unknown` rather than guessing deck. (`aiTakeoffParser.routing.test.ts`.)

### 3.3 OCR + Layout Agent — `planreader/extract.ts`, `scale.ts`, `titleBlock.ts`
- **Owns:** read titles, callouts, notes, **dimension strings**, the **scale**, legends, room labels. Preserve bounding boxes where available (`OcrBlock.bbox`, normalized `[0,1]`).
- **Must not:** convert pixels to metres without a calibrated scale. `scale_confidence == 0` ⇒ **pixel measurement is forbidden** (gate `scale = 0.5`).
- **In → out:** sheet image → `ExtractedSheet` (OCR blocks + parsed dimensions + scale + units).
- **Failure:** low aggregate OCR confidence (`ocr = 0.6`) ⇒ dimensions flagged `needs_review`, not trusted.

### 3.4 Geometry / Vision Agent — `takeoff/geometry.ts` (maths) + `scan-drawing/route.ts` (vision read)
- **Owns:** turn read shapes into **measured** features — wall runs, openings, slab/deck extents, footprint area & perimeter. Region-sum for L/T/U/stepped footprints (≈90% of real footprints); primitive shapes (triangle/circle/trapezoid) for the rest.
- **Must not:** approximate a non-rectangular footprint by its bounding box (over-quotes). Must separate **measured** vs **detected-low-confidence** vs **not-found** — never collapse "not found" into 0.
- **In → out:** `PlanGeometryInput` → `{ area_m2, perimeter_m, … }` plus per-feature provenance.
- **Gate:** `geometry_completeness` — missing closed areas / wall runs ⇒ block. `text_vs_geometry` — a labelled dimension and a measured dimension must agree within 5% (`text_vs_geometry_tolerance`); on mismatch, **surface BOTH** and flag review.

### 3.5 Deterministic Calculator Agent — `takeoff/calculators/*`, `foundationCalculator.ts`
- **Owns:** convert *validated* inputs into **quantities only**, per scope family. One calculator per scope (`deck`, `framing`, `lining`, `insulation`, `concrete`, `cladding`, `roofing`, `fencing`, `fixing`, `generic`). Stock-length conversion + waste factors live here, reproducibly.
- **Must not:** contain any pricing. Must not run at all if a required input is missing — that's the `required_dims_present` gate.
- **In → out:** `ExtractedExtraction` → `ScopeResult { lines: TakeoffLine[], status, summary, assumptions, clarifications, explanation, evaluator? }`.
- **Provenance:** every `TakeoffLine` carries a `basis: LineBasis { formula, inputs, assumed[], stockNote }` and `assumption_flags[]` / `validation_flags[]`. `requiresReview` (materialCalculator) → `takeoff_status:"needs_review"`.

### 3.6 CSI / Trade-Mapping Agent — `takeoff/csi/*` ❰**NEW — see §5**❱
- **Owns:** map each `TakeoffLine` into a CSI/MasterFormat-style division + a small-tradie trade bucket. Pure lookup; no quantities, no prices.
- **In → out:** `TakeoffLine[]` (+ `ScopeType`) → `CsiLineItem[]`.

### 3.7 Review / Clarification Agent — `takeoff/clarify.ts`, `validate.ts`, `evaluate.ts`, `blockedLineGuide.ts`
- **Owns:** turn "can't run because X is missing" into a **specific, answerable** `ClarificationQuestion` (field-scoped, with `blocking` flag, unit, and suggestion chips). Produce blocked `TakeoffLine`s with user-facing recovery copy.
- **Must not:** invent a quantity to avoid asking. A missing required input becomes a **blocked line**, a **clarification**, or a **review flag** — never a number.
- **Output to UI:** `ClarificationQuestion[]` + blocked lines; `blockedLineGuide(description)` renders the "enter these dimensions, then Recalculate / type a qty to keep manual / remove" guidance.

---

## 4. MCP / tool-boundary design

**Host = the orchestrator. Each specialist = an isolated tool-server.** The point of MCP framing here is **least-context**: the geometry server should never see the user's account, the classifier should never see other sheets, the calculator should never see the raw image. Today these are in-process modules; MCP framing makes the boundary explicit and lets the heavy/independent ones (vision, OCR) move to remote services later **without changing the host contract**.

### 4.1 Tool-server catalogue

| Server | Tools it exposes | Resources it reads | Prompts | Local first? |
|---|---|---|---|---|
| `intake` | `split_pages`, `extract_metadata`, `read_title_block` | the uploaded file (one job only) | — | **Local** (pdf split is already client-side) |
| `classify` | `classify_sheet` | one sheet image + filename + title text | sheet-type vote prompt | **Local** now → **Remote** if a fine-tuned classifier lands |
| `ocr` | `read_text`, `read_scale`, `read_dimensions` | one sheet image | OCR/transcribe prompt (null-for-unknown) | **Remote-capable** (vision heavy) |
| `geometry` | `compute_geometry`, `reconcile_text_vs_geometry` | one `ExtractedSheet` (no image, no account) | — (pure maths) | **Local** (deterministic) |
| `calculator` | `run_calculator` (per scope) | one validated `ExtractedExtraction` | — (pure) | **Local always** (must be reproducible & offline-testable) |
| `csi` | `map_to_csi` | `TakeoffLine[]` | — (pure lookup) | **Local always** |
| `review` | `build_clarifications`, `explain` | scope result + validator flags | clarification-phrasing prompt | **Local** |

### 4.2 Least-context rules (enforced at the host)
- The **calculator and CSI servers never receive an image or an account id** — only validated numeric inputs. This is what makes them deterministic and unit-testable, and it's already true in code (`runCalculator(extraction, scope)`).
- The **classifier and OCR servers receive a single sheet**, never the whole set — no cross-sheet leakage, and it parallelizes cleanly per page.
- The **host is the only component that touches Supabase / `auth.getUser()` / storage.** Tool-servers are pure functions over their typed input. (Today: API routes are the host; the lib modules are pure.)

### 4.3 Local-first → remote later
1. **Now (local):** every server is an in-process module behind `takeoff/index.ts` and `planreader/*`. The "tool call" is a function call. This is correct for an MVP and keeps everything in one deploy.
2. **Later (remote):** the two model-bound, independently-scalable servers — `ocr` and `classify` — become HTTP/MCP services. The host keeps the *same* typed contract (`ExtractedSheet`, `SheetClassification`); only the transport changes. The deterministic servers (`geometry`, `calculator`, `csi`) **stay local** — there is no benefit to remoting pure maths, and remoting it would only add a failure mode.

**Recommendation:** do **not** prematurely split anything into a remote MCP server. Keep the *boundaries* (typed contracts, no shared state, no account access in pure stages) and remote only when vision throughput or a specialised model forces it.

---

## 5. Data contracts

Every payload distinguishes the four provenance states the request requires:

| Provenance | How it's represented today |
|---|---|
| **measured** | `DimensionSource:"geometry"`; `TakeoffLine.basis.inputs` with the input NOT in `basis.assumed[]`; `quantity_source:"calculator"`. |
| **inferred via deterministic formula** | `TakeoffLine.basis.formula` present; value derived but inputs were user-supplied; `takeoff_status:"ok"` or `"assumed"` if a default was substituted (input listed in `basis.assumed[]`). |
| **missing / blocked** | `takeoff_status:"blocked"` + a `ClarificationQuestion {blocking:true}`; `ExtractedExtraction.needs_clarification[]`. |
| **unsupported** | `SheetType` not in `SUPPORTED_SHEET_TYPES` → sheet labelled & skipped; never extracted. |

### 5.1 Existing contracts (reuse — do not re-invent)
- **Uploaded drawing set:** `PlanFileRecord`, `PlanSheetRecord` (`planreader/schema.ts`).
- **Sheet classification result:** `SheetClassification {sheet_type, confidence, basis[]}`.
- **OCR/layout result:** `ExtractedSheet`, `OcrBlock {text, bbox: BBox|null, confidence}`, `BBox {x,y,w,h}` normalized `[0,1]`, `DimensionSource:"text"|"geometry"`.
- **Geometry result:** `PlanGeometryInput` + computed `{area_m2, perimeter_m, …}` (`takeoff/geometry.ts`).
- **Clarification question:** `ClarificationQuestion {id, scope, field, question, hint?, blocking, suggestions?, unit?}`.
- **Deterministic quantity output:** `TakeoffLine {…, basis: LineBasis, confidence, assumption_flags[], validation_flags[], explanation}`, aggregated as `ScopeResult` and `TakeoffResult`.
- **Blocked line payload:** a `TakeoffLine` with `takeoff_status:"blocked"` + the `blockedLineGuide()` recovery copy.
- **Confidence / evidence payload:** `EvaluatorVerdict {status, reasons[], confidence, requires_manual_confirmation}` + `SheetClassification.basis[]` + the six gate results.
- **Review quote payload:** `quote_data.line_items` on the `quotes` row (live editable copy), with `ai_snapshot` as the frozen original.

### 5.2 New contract — CSI-mapped line item (`src/lib/takeoff/csi/contracts.ts`)
The only wholly-missing contract. Pure additive types; not wired into the live path until Phase 6. (See the committed stub file alongside this doc.)

```ts
// MasterFormat-aligned divisions we actually touch as a small-tradie product.
export type CsiDivision =
  | "03_concrete"      // slabs, piles, footings, foundations
  | "05_metals"        // steel framing, brackets, fixings where structural
  | "06_wood_plastics" // carpentry: framing timber, decking, blocking
  | "07_thermal_moisture" // insulation, building wrap, cladding/weatherboard
  | "09_finishes"      // GIB / plasterboard, stopping, linings
  | "uncategorized";   // explicit — never silently bucketed

export type TradeBucket =
  | "concrete" | "framing" | "decking" | "cladding"
  | "insulation" | "lining" | "fixings" | "other";

export interface CsiLineItem {
  /** The takeoff line this maps (carry the source line id/desc through). */
  source_description: string;
  division: CsiDivision;
  trade: TradeBucket;
  /** Why it landed in this division — auditable, mirrors basis[] style. */
  mapping_basis: string[];      // e.g. ["scope:deck", "name:decking boards"]
  /** Carried straight through; CSI mapping NEVER alters quantities. */
  quantity: number;
  unit: string;
  /** Carried straight through; pricing stays manual (PRICES_OFF). */
  unit_price: number | null;
  /** Mirrors takeoff_status so review/blocked state survives the mapping. */
  takeoff_status: "ok" | "assumed" | "needs_review" | "blocked";
}
```

**Mapping rules (deterministic, scope-first then name):**
- `concrete`/foundation scope → `03_concrete`.
- `framing` scope, timber → `06_wood_plastics`; structural steel brackets/fixings → `05_metals`.
- `deck` scope → `06_wood_plastics` (decking, joists, bearers); concrete piles from a deck → `03_concrete`.
- `insulation` → `07_thermal_moisture`; `cladding`/weatherboard → `07_thermal_moisture`.
- `lining`/GIB → `09_finishes`.
- **No confident mapping → `uncategorized`, surfaced in review.** Never a silent default division.

**Guard interaction:** CSI mapping runs **after** `scopeFamily.guardLinesForScope()`, so a deck line that leaked into a wall quote is already stripped before it could be miscategorised into `06`.

---

## 6. Accuracy strategy

**100% automatic perfection is not realistic and we do not design for it.** We design for *bounded, traceable, review-gated* accuracy on **supported sheet types only**.

### 6.1 What can realistically be automated (supported sheets: deck, floor_plan, foundation)
- Sheet classification with a confidence + evidence trail.
- Reading clearly-labelled dimension strings and a stated scale.
- Footprint area/perimeter, wall runs, opening counts where the geometry is legible.
- Quantity calculation from validated inputs (this is exact and deterministic).

### 6.2 What must stay review-gated (always)
- Any sheet below `classification = 0.65`, or `unknown`/unsupported.
- Any measured dimension where `text_vs_geometry` disagreement > 5%.
- Any scope missing a required input (`required_dims_present` fails) → blocked line + clarification.
- Any `EvaluatorVerdict.status != "pass"` → manual confirmation at the send gate.
- **Pricing — always.** `PRICES_OFF = true`; quantity-first, prices entered by the tradie.

### 6.3 What "production-grade accuracy" means for *this* product
Not "the AI is always right." It means:
1. **On supported sheets, it is right or it asks** — no silent wrong number ever reaches a customer-facing quote.
2. **Every number is traceable** to its `basis.formula` + inputs + the evidence that classified the sheet.
3. **Wrong-scope leakage rate ≈ 0** — measured as an explicit eval metric (§7), backstopped by `scopeFamily.ts`.
4. **Unsupported drawings are visibly unsupported**, not silently half-processed.

---

## 7. Evaluation strategy

Scope expansion is **evidence-gated**, not vibes-gated. Harness: `npm run eval:plans` (exists; fixtures pending — task #35).

### 7.1 Fixtures
Labelled real plans per supported sheet type, each with a hand-authored expected: sheet type, key dimensions, expected quantities (tolerance band), and expected blocked/clarification set.

### 7.2 Metrics (per sheet type)
- **Classification accuracy** — % sheets classified correctly; confusion matrix (esp. deck↔floor_plan).
- **Measurement error** — |measured − truth| / truth, with a per-dimension tolerance (start at ±5%, the `text_vs_geometry` band).
- **Blocked-vs-auto decision quality** — of items the system auto-calculated, how many *should* have been blocked (false-confident), and vice-versa (over-blocking). Both are failures; false-confident is the worse one and weighted higher.
- **Wrong-scope leakage rate** — count of quotes where a material family appears that doesn't belong to the classified scope (e.g. deck materials in a wall quote). **Target: 0.** This is the headline safety metric; `scopeFamily.test.ts` already unit-tests the guard, the eval measures it end-to-end.
- **Clarification precision** — are the questions answerable and field-specific, or vague?

### 7.3 Acceptance gates before expanding scope
A new sheet type or calculator ships to preview only when, on its fixture set: classification ≥ 0.9 accuracy, measurement within tolerance on ≥ 0.9 of dims, **wrong-scope leakage = 0**, and zero false-confident auto-calcs. Below that, it stays behind the feature flag.

---

## 8. Tradies2Quote integration

The pipeline plugs into the **existing** quote/review workflow — it does not replace it.

```
Scan drawing upload ─► api/quotes/scan-drawing (single) ─┐
Multi-sheet set ─────► api/plans/{ingest,classify,extract}┤
Voice / typed ───────► transcribe ─► detectTakeoffType ───┼─► api/quotes/generate
                                                          │     runTakeoff(orchestrator)
                                                          │     + scopeFamily guard
                                                          │     + (Phase 6) CSI map
                                                          ▼
                                            quote_data.line_items  (Review Quote)
                                            takeoff_status drives badges
                                            blockedLineGuide drives recovery copy
                                            Takeoff assumptions panel → Recalculate
                                            PRICES_OFF → manual price entry per line
```

**Existing product rules this honours (verbatim from CLAUDE.md / prior decisions):**
- **No-guess policy** — `null` for unknowns; gates block; clarifications instead of defaults.
- **Quantity-first** — calculators emit counts only; `PRICES_OFF` zeroes price fields.
- **Manual prices** — the tradie enters every price; the AI never sets one.
- **Visible blocked recovery** — `blockedLineGuide()` copy + the shared Takeoff-assumptions panel + Recalculate.
- **No auto-prefill from AI guesses** — Review prefills only from the user's own prior answers (`dimension_confirmation`), never from a model guess.
- **Legacy quotes not silently rewritten** — corrected routing applies on generate/Recalculate, not on passive load.

---

## 9. Roadmap (reconciled with what's already shipped)

| Phase | Goal | Status |
|---|---|---|
| **1** | Architecture + contracts + sheet classification | ✅ Done (`planreader` schema, classifier, ingest/classify routes, gates) |
| **2** | OCR/layout + scale + supported wall/floor path | ✅ Done (`extract.ts`, `scale.ts`, `titleBlock.ts`, extract route) |
| **3** | Deterministic wall/GIB/insulation calculators | ✅ Done (`calculators/{framing,lining,insulation}.ts`, geometry) |
| **4** | Review/clarification + blocked-line recovery | ✅ Done (`clarify`, `validate`, `blockedLineGuide`, recovery doc) |
| **5** | Foundation + deck expansion | ✅ Foundation done (`foundationCalculator/Adapter`); deck live. **Next: wire multi-sheet `planreader` set → orchestrator** (today's live scan is single-image). |
| **6** | **CSI export/reporting + confidence analytics** | ❌ **Not started — build the `takeoff/csi/*` layer (§5) + a CSI-grouped view/export.** |
| **7** | Fixture eval gates + production readiness | ◻ Harness exists (`eval:plans`); **fixtures + the acceptance gates in §7 are the gating work.** |

**The two genuinely-open phases are 6 (CSI) and 7 (eval gates).** Phase 5's remaining slice is the planreader→orchestrator wiring for true multi-sheet sets.

---

## 10. Deliverables summary

### 10.1 Proposed folder / service structure
```
src/lib/
├── planreader/                 # Intake + classify + OCR + gates (model-bound stages)
│   ├── ingest.ts  pdfSplit.client.ts  storage.ts  titleBlock.ts   # 1 Intake
│   ├── classify.ts                                                 # 2 Classify
│   ├── extract.ts  scale.ts                                        # 3 OCR/layout
│   ├── gates.ts                                                    # 6 gates (the safety spine)
│   └── schema.ts  observability.ts
└── takeoff/                    # Route + extract + validate + calculate (deterministic core)
    ├── scope-router.ts  extraction.ts  validate.ts  clarify.ts     # 2/3/7
    ├── geometry.ts                                                 # 4 Geometry maths
    ├── calculators/*.ts  foundationCalculator.ts                   # 5 Calculators
    ├── scopeFamily.ts                                              # wrong-scope guard
    ├── evaluate.ts  explain.ts                                     # confidence + narrative
    ├── csi/            ❰NEW❱  contracts.ts  map.ts  map.test.ts     # 6 CSI mapping
    ├── orchestrator.ts  index.ts                                   # host glue
    └── schemas.ts                                                  # contracts
```

### 10.2 Local-module vs MCP-service recommendation
- **Keep local (always):** `geometry`, all `calculators`, `csi`, `validate`, `clarify`, `scope-router`, `scopeFamily`. They are pure, deterministic, and must stay unit-testable and offline. Remoting them adds failure modes and zero benefit.
- **Candidate remote MCP services (only when forced by throughput/model needs):** `ocr` and `classify` — the vision-bound stages. Keep the typed contracts identical so the host doesn't change.
- **Host stays in the Next.js API routes.** It is the only component with Supabase/account access.

### 10.3 Risk list
1. **Vision misreads a dimension confidently** → wrong quantity. *Mitigated:* `text_vs_geometry` reconciliation + evaluator + send gate; *residual:* a wrong label the geometry agrees with. Keep ±5% tolerance tight; surface both sources.
2. **Wrong-scope material leakage** (deck items in a wall quote). *Mitigated:* `detectTakeoffType` Job-type authority + `scopeFamily` guard + eval metric (§7.2). *Residual:* a new scope's material names not yet in the guard regex — extend the guard with each new calculator.
3. **Unsupported sheet processed as supported** → garbage. *Mitigated:* `isSupportedSheetType` + classification gate; *residual:* a confident-but-wrong classification — hence the confusion-matrix eval.
4. **Silent scale/units error** (mm vs m, imperial). *Mitigated:* `scale_confidence==0` forbids pixel measurement; `LengthUnit` explicit. *Residual:* a stated-but-wrong scale on the drawing — flag implausible footprints via the evaluator.
5. **Multi-sheet set: a measurement on sheet 2 that contradicts sheet 1.** Not yet handled (single-sheet today). The planreader→orchestrator wiring (Phase 5 remainder) must define cross-sheet reconciliation as block-on-conflict.
6. **CSI mis-bucketing** miscommunicates to the tradie. *Mitigated:* `uncategorized` is explicit, mapping runs after the scope guard, `mapping_basis[]` is auditable.
7. **Eval fixtures don't represent real hand-drawn plans** → false confidence in the gates. *Mitigated:* fixtures must be real customer plans (anonymised), not synthetic.
8. **Prompt drift** re-introduces guessing. *Mitigated:* the "null for unknown, no quantities" rule is enforced in code (gates + `parse*`), not just the prompt — the prompt can drift but the gate still blocks.

### 10.4 What to build first (recommended)
**Do not start a greenfield rewrite — the core exists.** In order:

1. **CSI mapping layer (`takeoff/csi/`)** — pure, additive, fully unit-testable, zero risk to the live path, and it's the only wholly-missing contract. Ship `contracts.ts` (stub committed alongside this doc) → `map.ts` → `map.test.ts`, behind a flag, rendering a CSI-grouped *view* of an already-calculated quote. **This is the highest-value, lowest-risk next chunk.**
2. **Eval fixtures + the §7 acceptance gates** — turn `eval:plans` from a harness into a gate. This is what lets every later expansion be evidence-based, including the wrong-scope-leakage = 0 guarantee.
3. **planreader→orchestrator multi-sheet wiring** (Phase 5 remainder) — only after 1 & 2, because it's the riskiest (cross-sheet reconciliation) and benefits most from having the eval gates in place first.

**Constraint reminder honoured throughout:** preview/dev only, no production deploy, deterministic + review-safe over ambitious guessing, no pretence that unsupported drawings are solved.
