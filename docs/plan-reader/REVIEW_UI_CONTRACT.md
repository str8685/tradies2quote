# Foundation review-UI contract (prep — NOT wired)

> Contract-only. `src/lib/takeoff/foundationReviewModel.ts` turns the adapter's
> blocked clarifications into a deterministic field model a mobile screen can
> render directly. No React, no routes, no flags — nothing imports it at
> runtime yet. This doc shows the round trip: blocked payload → render → the
> exact `confirmed` shape the UI sends back.

## 1. Example blocked payload (from the adapter)

`runFoundationCalculator(ext)` where the slab footprint is known but the section
measurements are missing returns `status: "blocked"` with:

```jsonc
{
  "scope": "foundation",
  "status": "blocked",
  "lines": [],
  "assumptions": [],
  "clarifications": [
    { "field": "slab_thickness_mm", "question": "What is the slab thickness in mm?",
      "hint": "Most residential slabs are 100–150 mm.", "blocking": true,
      "unit": "mm", "suggestions": ["100","125","150"],
      "input_kind": "number", "required": true,
      "source": "missing_required_input", "display_order": 3 },
    { "field": "footing_width_mm", "question": "How wide are the footings in mm?",
      "unit": "mm", "suggestions": ["300","400","450"], "input_kind": "number",
      "required": true, "source": "missing_required_input", "display_order": 4 },
    { "field": "footing_depth_mm", "question": "How deep are the footings in mm?",
      "unit": "mm", "suggestions": ["400","450","600"], "input_kind": "number",
      "required": true, "source": "missing_required_input", "display_order": 5 }
  ]
}
```

(If the footprint is also unknown, a `slab_size` clarification with
`input_kind: "dimensions_pair"`, `display_order: 1` leads the list.)

## 2. Derived field model

`buildFoundationReviewModel(result.clarifications)` →

```jsonc
{
  "status": "blocked",
  "title": "Enter the missing foundation measurements",
  "fields": [
    { "key": "slab_thickness_mm", "label": "What is the slab thickness in mm?",
      "hint": "Most residential slabs are 100–150 mm.", "control": "number",
      "unit": "mm", "required": true, "optional": false,
      "suggestions": ["100","125","150"], "order": 3,
      "source": "missing_required_input", "confirmed_keys": ["slab_thickness_mm"] }
    // … footing_width_mm, footing_depth_mm …
  ],
  "required_keys": ["slab_thickness_mm","footing_width_mm","footing_depth_mm"]
}
```

For a `slab_size` field the model emits:

```jsonc
{ "key": "slab_size", "control": "dimensions_pair", "unit": "m",
  "required": true, "optional": false, "order": 1,
  "parts": [
    { "confirmed_key": "slab_length_m", "label": "Length", "unit": "m" },
    { "confirmed_key": "slab_width_m",  "label": "Width",  "unit": "m" }
  ],
  "confirmed_keys": ["slab_length_m","slab_width_m"] }
```

## 3. How the mobile screen renders it

Render `fields` top-to-bottom (already sorted by `order`). Per `control`:

| control | render |
|---|---|
| `number` | one numeric input; `unit` as a trailing adornment; `suggestions` as tap chips that fill the input. |
| `dimensions_pair` | two numeric inputs side by side (`parts[0]` Length, `parts[1]` Width), sharing the `unit`. |
| `select` | reserved — a picker over `options` (none emitted today). |

Rules:
- Show a "Required" / "Optional" affordance straight from `required` (never infer).
- `source: "invalid_value"` → red helper styling ("that value looks off").
- Keep `label` + `hint` short (they already are) — mobile-first, one line each.
- **Never pre-fill an answer.** The model carries no `value`/`default`; chips are
  suggestions, not selections.
- Enable "Calculate" only once every key in `required_keys` has a value;
  `optional: true` fields may stay blank.

## 4. Exact response the UI sends back (`confirmed`)

The UI collects answers into a flat `confirmed` object keyed by each field's
`confirmed_keys`, then calls `runFoundationCalculator(ext, confirmed)` again:

```jsonc
// confirmed: Partial<FoundationInput>
{
  "slab_length_m": 10,      // from a dimensions_pair part (if slab_size shown)
  "slab_width_m": 8,
  "slab_thickness_mm": 100, // number field
  "footing_width_mm": 300,
  "footing_depth_mm": 600,
  "internal_footing_run_m": 0   // optional; omit to accept the documented default
}
```

Rules:
- Send **numbers**, in the unit named by the key suffix (`_mm` / `_m` / `_m2`).
- Omit a field rather than send `null`/`undefined` — empty values are ignored and
  will not clobber a value already derived from the drawing.
- A complete `confirmed` flips `status` from `blocked` to `assumed`/`ok` and the
  result returns priced-ready `lines`.

## 5. Still blocking eventual UI wiring

- This is a **data contract only** — the actual React screen, its state, and the
  `confirmed`-submit call are not built (deliberately).
- The adapter isn't in `routeScope()` / `CALCULATORS`, so there's no endpoint yet
  that returns a foundation result to a screen.
- Section dims still can't come from extraction (Phase 3), so in practice the
  review screen is REQUIRED for foundations until extraction is richer.
- When the screen is built it must stay behind the existing `PLAN_READER_ENABLED`
  route-level flag + owner-only posture until fixtures + eval prove behaviour.

## Contract discipline

Do not add a control kind, a `dimensions_pair` field mapping, or any field to
the review model without updating `foundationReviewModel.ts`, its tests
(`foundationReviewModel.test.ts`), and this doc in the SAME change.
