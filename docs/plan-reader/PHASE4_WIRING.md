# Phase 4 wiring — foundation adapter (internal, NOT YET WIRED)

> Status: the foundation calculator + adapter are built, deterministic, and
> fully unit/characterization-tested, but **deliberately isolated** — no
> `ScopeType` entry, no `CALCULATORS` registration, no runtime import, no route
> usage. This doc is the recipe for the future wiring step. Nothing here is
> active yet.

## 1. How `foundationAdapter` plugs into the orchestrator

Today the orchestrator dispatches a `ScopeType` to a calculator via
`src/lib/takeoff/calculators/index.ts` → `CALCULATORS: Record<ScopeType, (ext) => ScopeResult>`.

To wire foundation in (when extraction is real + measured):

1. Add `"foundation"` to `ScopeType` + `ALL_SCOPES` in `src/lib/takeoff/schemas.ts`.
   - The two local override types in the adapter (`FoundationScope`,
     `FoundationClarification`, `FoundationScopeResult`) then collapse onto the
     shared `ScopeResult` / `ClarificationQuestion` with **no behavioural change**.
2. Register it: `foundation: (ext) => runFoundationCalculator(ext, confirmedFor(ext))`
   in the `CALCULATORS` map.
3. Teach `routeScope()` to emit `"foundation"` for foundation sheets (this is the
   only step that depends on Phase 3 geometry / richer extraction — until then
   nothing routes to it, so registration alone is dormant).
4. Gate the whole path behind the existing route-level flag posture
   (`PLAN_READER_ENABLED`, owner-only) — the adapter itself stays flag-agnostic
   (it's pure maths; proven by a flag-OFF == flag-ON characterization test).

**Signature:** `runFoundationCalculator(ext: ExtractedExtraction, confirmed?: Partial<FoundationInput>) => FoundationScopeResult`. It never throws — `FoundationInputError` is caught and turned into a blocked result.

## 2. How blocked clarifications should surface in the UI

When `status === "blocked"`, render the `clarifications[]` as a short form. Each
item is machine-usable — **never string-sniff the question text**:

| field | meaning |
|---|---|
| `field` | stable key to write the answer back under (e.g. `slab_thickness_mm`) |
| `question` | short tradie-friendly label, e.g. "What is the slab thickness in mm?" |
| `hint` | one-line helper text |
| `unit` | `"mm"` / `"m"` — show as a suffix/adornment |
| `suggestions` | quick-pick chips (e.g. `["100","125","150"]`) |
| `input_kind` | which control: `number` · `dimensions_pair` · `select` · `text` |
| `required` | `true` ⇒ must be answered; `false` ⇒ optional |
| `source` | `missing_required_input` · `invalid_value` · `conflict` (drives copy/icon) |
| `display_order` | render ascending — already pre-sorted in the payload |
| `blocking` | always `true` for a blocked result |

Rendering rules:
- `input_kind: "dimensions_pair"` → two number inputs (length + width) sharing
  one `unit`.
- `input_kind: "number"` → single number input; show `suggestions` as chips.
- `source: "invalid_value"` → phrase as "that value looks off — please re-enter".
- Disable the "Calculate" button until every `required: true` item is answered;
  `required: false` items may be left blank (the calculator applies its
  documented default and records it as an assumption).

## 3. What the review UI must return in `confirmed`

`confirmed` is `Partial<FoundationInput>` — write each answered `field` straight
through. The keys the UI can supply:

| field | unit | required |
|---|---|---|
| `slab_length_m` + `slab_width_m` (the `slab_size` pair) | m | one of (size) / (area+perimeter) |
| `slab_area_m2` + `slab_perimeter_m` | m² / m | alternative to length+width |
| `slab_thickness_mm` | mm | **required** |
| `footing_width_mm` | mm | **required** |
| `footing_depth_mm` | mm | **required** |
| `internal_footing_run_m` | m | optional (omit ⇒ 0) |
| `config` (waste %, mesh sheet size, lap, order step) | — | optional template overrides |

Rules:
- Send **numbers**, in the units named by the `field` suffix (`_mm` / `_m` / `_m2`).
- `null` / `undefined` values are ignored (won't clobber an extracted value).
- Re-run `runFoundationCalculator(ext, confirmed)` after each save; a complete
  set flips `status` from `blocked` to `assumed`/`ok` and returns priced-ready
  lines.

## 4. What must NEVER be defaulted silently

These are **measurements**, not config — they must come from the drawing or the
tradie, never a guess. If absent, the result stays `blocked`:

- slab footprint — `slab_length_m`+`slab_width_m` **or** `slab_area_m2`+`slab_perimeter_m`
- `slab_thickness_mm`
- `footing_width_mm`
- `footing_depth_mm`

What MAY default (estimating template, always surfaced as an assumption):
concrete waste %, mesh sheet size + lap, concrete order step, and
`internal_footing_run_m` (→ 0, "no internal footings"). Every applied default
appears in `result.assumptions` and on the affected line's `assumption_flags`
with `basis.assumed` naming the config key — nothing is hidden.

## 5. Anything that could still block future wiring

- **Extraction can't yet carry section dims.** `slab_thickness_mm` /
  `footing_width_mm` / `footing_depth_mm` are not in `ExtractedExtraction`, so
  until Phase 3 geometry or a richer extraction schema exists, foundation sheets
  will **always** block for these and require the review UI. That's correct
  behaviour, but it means foundation isn't useful end-to-end until either (a) the
  review UI ships, or (b) extraction learns to read footing/slab sections.
- **`routeScope()` has no foundation path.** Registering the calculator is inert
  until routing emits `"foundation"`; that step needs the measured classifier.
- **Perimeter from area.** When a sheet gives area but not a rectangle, the
  adapter must be fed `slab_perimeter_m` — geometry extraction (Phase 3) should
  provide it, otherwise it's a required clarification.
- **No conflict detection yet.** `source: "conflict"` is defined in the contract
  but the calculator doesn't yet raise text-vs-geometry conflicts (that's the
  deferred `text_vs_geometry` gate). Wire that when geometry lands.
- **Pricing/material match.** Lines carry `priceMatchKey` (the line key); Phase 4
  must map those to the material library for $ figures.
