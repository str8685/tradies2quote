# Foundation review screen — mobile UX spec (spec-only, NOT built)

> Spec only. Defines the exact mobile UX contract for rendering
> `buildFoundationReviewModel()` output and collecting a valid `confirmed`
> payload back. No React, no components, no routes, no calculator wiring is
> implemented by this doc — it is the blueprint for that future slice.
>
> Inputs/outputs are already locked: see `foundationReviewModel.ts`
> (field model) and `REVIEW_UI_CONTRACT.md` (data round-trip). This doc adds
> the on-screen behaviour.

Design principles (tradie-first, on-site, one-handed):
- **One question per row.** Never two unrelated inputs on a line.
- **Unit always visible** on every numeric input.
- **Suggestion chips tap-to-fill, never auto-selected.**
- **Required fields first.** Optional fields clearly marked / collapsed.
- Big tap targets (≥44 px), high contrast, minimal reading.

---

## 1. Screen title + section structure

Driven entirely by the review model:

```
┌──────────────────────────────────────────┐
│  ‹ Back            FOUNDATION              │   ← app chrome (existing)
│                                            │
│  {model.title}                             │   ← e.g. "Enter the missing
│  Short subline: "We need a few measurements│      foundation measurements"
│  to calculate concrete + steel."           │
│                                            │
│  ── REQUIRED ───────────────────────────── │   ← section header (always)
│   [ field row ]                            │   model.fields where required
│   [ field row ]                            │   (rendered in `order`)
│                                            │
│  ── OPTIONAL ───────────────────────────── │   ← only if optional fields exist
│   [ field row ]  (collapsed by default)    │   model.fields where !required
│                                            │
│  [ Calculate ]   (sticky bottom)           │   enabled per §6
└──────────────────────────────────────────┘
```

- **Title** = `model.title` verbatim (`"Enter the missing foundation
  measurements"` when blocked; the screen is not shown when `status: "ready"`).
- **Two sections, in this order: Required, then Optional.** Within each section,
  render fields ascending by `field.order` (the model is already pre-sorted —
  the screen must not re-order).
- The **Optional** header + rows render only if at least one field has
  `optional: true`; collapse them behind a "Show optional" disclosure by default.

## 2. Required vs optional appearance

- Read `field.required` / `field.optional` directly — **never infer from
  presence or position.**
- Required rows: in the Required section, no badge needed (the section header
  carries the meaning), but show a subtle required marker (e.g. a small dot) for
  scanability.
- Optional rows: in the Optional section, each row shows an "Optional" pill and a
  one-line "Leave blank to use the standard allowance" helper.
- `field.source === "invalid_value"` rows: render with error styling (red helper
  text) and lead with "That value looked off — re-enter it." regardless of
  section.

## 3. Number field rendering (`control: "number"`)

```
Slab thickness                              ● required
What is the slab thickness in mm?
┌───────────────────────────┐   mm
│  [        ]               │            ← numeric keypad, unit suffix "mm"
└───────────────────────────┘
 [100]  [125]  [150]                       ← suggestion chips (tap to fill)
```

- `label` = `field.label` (the question). `hint` below it if present.
- Single numeric input, **`field.unit` shown as a persistent suffix/adornment.**
- Mobile numeric keyboard; reject non-numeric entry.
- Chips = `field.suggestions`; tapping one **fills** the input (does not submit,
  does not lock — the tradie can still type over it).
- Writes to `field.confirmed_keys[0]`.

## 4. `dimensions_pair` rendering (`control: "dimensions_pair"`)

```
Slab size                                   ● required
What are the slab length and width in metres?
┌──────────┐  ×  ┌──────────┐   m
│ Length   │     │ Width    │              ← two linked numeric inputs
└──────────┘     └──────────┘
```

- One row, **two numeric inputs** from `field.parts` (`[0]` Length, `[1]` Width),
  sharing the single `field.unit` ("m").
- Each part writes to its own `parts[i].confirmed_key`
  (`slab_length_m`, `slab_width_m`).
- Both parts must be filled for the field to count as answered (see §6).
- No chips for the pair (none supplied).

## 5. `select` rendering (`control: "select"`) — reserved

- Not emitted today. When introduced: a single-choice picker over
  `field.options`, writing to `field.confirmed_keys[0]`. No free text.

## 6. When "Calculate" enables

- Disabled until **every key in `model.required_keys` has a valid value.**
  - For a `dimensions_pair`, that means BOTH `confirmed_keys` are filled.
- Optional fields never block the button.
- Tapping "Calculate" submits the assembled `confirmed` object (§8) — in the
  real build this re-invokes `runFoundationCalculator(ext, confirmed)`.
- Button label: "Calculate" (first pass) / "Recalculate" if returning after a
  prior result. Sticky to the bottom of the viewport, full-width, ≥44 px.

## 7. Validation / error rules

Per input, on blur and on submit:
- **Required + empty** → "Enter the {label}." Block submit.
- **Non-numeric** → "Enter a number." Block submit.
- **≤ 0** → "Must be greater than 0." (foundation inputs are positive measurements.)
- **Optional + empty** → valid (the calculator applies its documented default and
  reports it as an assumption).
- **Optional + present but invalid** (e.g. negative) → error styling; block submit
  until fixed or cleared. Matches the calculator's `internal_footing_run_m >= 0`
  rule.
- Plausibility (soft, non-blocking, advisory only): warn if a value is wildly out
  of band (e.g. slab thickness > 1000 mm) but still allow submit — the
  deterministic calculator + evaluator remain the source of truth.
- The screen performs **shape/positivity** validation only. It must NOT pre-empt
  the calculator's hard-fail logic or invent corrected values.

## 8. Exact `confirmed` payload sent back

A flat object keyed by the fields' `confirmed_keys` (`Partial<FoundationInput>`):

```jsonc
{
  "slab_length_m": 10,       // dimensions_pair part
  "slab_width_m": 8,         // dimensions_pair part
  "slab_thickness_mm": 100,  // number
  "footing_width_mm": 300,   // number
  "footing_depth_mm": 600    // number
  // internal_footing_run_m omitted → calculator uses 0 (documented assumption)
}
```

Rules:
- Send **numbers**, in the unit named by the key suffix (`_mm` / `_m` / `_m2`).
- **Omit** an unanswered optional field — do NOT send `null`/`undefined`
  (empty/null is ignored and won't clobber a value already read off the drawing).
- Do not send keys that weren't surfaced as fields.
- After submit, a complete payload flips the result `status` from `blocked` to
  `assumed`/`ok` and returns priced-ready lines.

## 9. What NEVER gets auto-filled

- **No numeric input is pre-populated.** The model carries no `value`/`default`;
  the screen must not seed one either.
- **Suggestion chips are not auto-selected** — they fill only on explicit tap.
- **Required measurements are never defaulted** (slab footprint, thickness,
  footing width/depth). If blank, the screen blocks; the calculator would
  hard-fail anyway.
- Only the calculator's documented **config/optional** values default
  (waste %, mesh sheet size + lap, order step, `internal_footing_run_m → 0`),
  and each surfaces as an assumption on the result — never silently on the form.

---

## 10. Full worked example

### 10a. Blocked payload (adapter output)
Drawing gave no usable footprint and no section sizes:

```jsonc
{
  "scope": "foundation", "status": "blocked", "lines": [], "assumptions": [],
  "clarifications": [
    { "field": "slab_size", "question": "What are the slab length and width in metres?",
      "hint": "Or give the total slab area in m² if it's not a simple rectangle.",
      "blocking": true, "unit": "m", "input_kind": "dimensions_pair",
      "required": true, "source": "missing_required_input", "display_order": 1 },
    { "field": "slab_thickness_mm", "question": "What is the slab thickness in mm?",
      "hint": "Most residential slabs are 100–150 mm.", "blocking": true,
      "unit": "mm", "suggestions": ["100","125","150"], "input_kind": "number",
      "required": true, "source": "missing_required_input", "display_order": 3 },
    { "field": "footing_width_mm", "question": "How wide are the footings in mm?",
      "hint": "Measured across the bottom of the footing trench.", "blocking": true,
      "unit": "mm", "suggestions": ["300","400","450"], "input_kind": "number",
      "required": true, "source": "missing_required_input", "display_order": 4 },
    { "field": "footing_depth_mm", "question": "How deep are the footings in mm?",
      "hint": "From the underside of the slab to the bottom of the footing.",
      "blocking": true, "unit": "mm", "suggestions": ["400","450","600"],
      "input_kind": "number", "required": true,
      "source": "missing_required_input", "display_order": 5 }
  ]
}
```

### 10b. Review model (`buildFoundationReviewModel`)
```jsonc
{
  "status": "blocked",
  "title": "Enter the missing foundation measurements",
  "required_keys": ["slab_length_m","slab_width_m","slab_thickness_mm","footing_width_mm","footing_depth_mm"],
  "fields": [
    { "key": "slab_size", "control": "dimensions_pair", "order": 1, "required": true,
      "optional": false, "unit": "m",
      "parts": [ {"confirmed_key":"slab_length_m","label":"Length","unit":"m"},
                 {"confirmed_key":"slab_width_m","label":"Width","unit":"m"} ],
      "confirmed_keys": ["slab_length_m","slab_width_m"], "suggestions": [] },
    { "key": "slab_thickness_mm", "control": "number", "order": 3, "required": true,
      "optional": false, "unit": "mm", "suggestions": ["100","125","150"],
      "confirmed_keys": ["slab_thickness_mm"] },
    { "key": "footing_width_mm", "control": "number", "order": 4, "required": true,
      "optional": false, "unit": "mm", "suggestions": ["300","400","450"],
      "confirmed_keys": ["footing_width_mm"] },
    { "key": "footing_depth_mm", "control": "number", "order": 5, "required": true,
      "optional": false, "unit": "mm", "suggestions": ["400","450","600"],
      "confirmed_keys": ["footing_depth_mm"] }
  ]
}
```

### 10c. On screen (Required section, in order)
```
Enter the missing foundation measurements
We need a few measurements to calculate concrete + steel.

── REQUIRED ─────────────────────────────────
Slab size
What are the slab length and width in metres?
[  10  ] × [   8  ]  m

Slab thickness
What is the slab thickness in mm?
[ 100 ] mm     [100] [125] [150]      ← tapped 100

Footing width
How wide are the footings in mm?
[ 300 ] mm     [300] [400] [450]      ← tapped 300

Footing depth
How deep are the footings in mm?
[ 600 ] mm     [400] [450] [600]      ← tapped 600

[ Calculate ]   ← enabled (all required_keys filled)
```

### 10d. `confirmed` sent back
```jsonc
{
  "slab_length_m": 10,
  "slab_width_m": 8,
  "slab_thickness_mm": 100,
  "footing_width_mm": 300,
  "footing_depth_mm": 600
}
```
Re-running `runFoundationCalculator(ext, confirmed)` then returns
`status: "assumed"` with the priced-ready lines (slab/footing concrete, total,
mesh) — each carrying its formula, inputs, and the waste/no-internal-footing
assumptions.

---

## 11. Contract discipline

The screen is a thin renderer over the locked field model. Do not introduce
on-screen fields, controls, or auto-fill behaviour that isn't represented in
`foundationReviewModel.ts`. Any change to controls/fields must update that
module, its tests, `REVIEW_UI_CONTRACT.md`, and this spec in the SAME change.
