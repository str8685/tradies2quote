# Floor-plan dimension-role contract

**Status:** Contract / scaffold only — non-runtime, not wired into any route, UI, calculator, or live planreader flow. No deploy.

This note captures the confirmed product decisions for how a floor-plan's
labelled/measured dimensions become calculator inputs via the
`sheetToExtraction` bridge (`src/lib/takeoff/bridge/`). It exists so the later
wiring task doesn't re-litigate semantics.

## 1. Role source (who decides a number's role)
A "role" = what a number *is* (`length` / `width` / `height` / `area` /
`perimeter` / `building_length` / `building_width`).

- **Primary: user confirmation.** The tradie confirms the role on Review Quote.
- **Secondary: deterministic text tagger** — only when the sheet's *raw printed
  text explicitly names the role* (e.g. "stud height", "floor area"). See the
  pattern list below.
- **Forbidden: model-guessed roles.** The vision model never assigns a role from
  a bare value. A number with no explicit role text stays **untagged** and goes
  to user confirmation.

## 2. Length semantics
- For **framing / lining / insulation**, the `length` role means **total wall
  run** (the summed length of the walls being built/lined/insulated).
- It is **never** silently reinterpreted as building perimeter.
- **Perimeter / exterior wall run is its own explicit role/value** (`perimeter`).
  It is not derived from `length` or from overall dims behind the user's back.
- **Overall building dimensions are distinct roles** (`building_length`,
  `building_width`). They are *recognized* but **not consumed by any
  calculator** — converting them into a wall run or a perimeter is an explicit,
  user-confirmed step the scaffold does not perform. So a plan that prints only
  "overall length / overall width" does **not** satisfy framing; it blocks for
  the wall-run `length` (correct: overall dims ≠ wall run).

## 3. Required roles (mirror `validate.ts`)
A scope is satisfiable when **any one** alternative set is fully present:
- **framing** → `length` + `height`
- **lining** → `area` **OR** `length` + `height`
- **insulation** → `area` **OR** `length` + `height`

Missing a required role → **blocked with an explicit reason**, never assumed.

## 4. `source_basis` refinement (per-role provenance)
Each roled dimension carries an explicit `source`:
- `user-typed` — the tradie entered the value directly.
- `labelled-sheet-confirmed` — read off a printed label *and* confirmed (by the
  user, or by the deterministic text tagger matching explicit role text).
- `geometry-measured` — measured from calibrated geometry (future; pixel path).

The live `ExtractedExtraction.source_basis` enum (`regex|llm|marker|manual`) is
**left unchanged**; the richer per-role `source` lives only in the bridge
contract until wiring is approved.

## Deterministic text-tagger — supported patterns
First match wins; case-insensitive; matches the dimension's `raw_text`. A value
≤ 0 or non-finite is ignored (never coerced). No match → untagged → user
confirmation.

| Role | Matched text (examples) |
|---|---|
| `height` | "stud height", "ceiling height", "wall height" |
| `area` | "floor area", "gross floor area", "GFA", "total floor area" |
| `perimeter` | "perimeter", "exterior wall run", "external wall run" |
| `length` (= total wall run) | "total wall length", "total wall run", "wall run", "wall length" |
| `building_length` | "overall length", "building length" |
| `building_width` | "overall width", "building width" |

**Deliberately NOT tagged** (→ user confirmation): a bare value ("3600"), a bare
"Length:"/"Width:" with no wall/overall qualifier, room callouts ("Bed 1: 3.6 ×
4.2"). These are ambiguous about role and must not be guessed.

## LOCKED POLICY — building dims are not wall run
Locked product rule (do not relax without an explicit reversal):

- **`building_length` / `building_width` must NOT be convertible to the generic
  wall-run `length` role** — not even with an explicit acknowledgement. There is
  no "broad conversion freedom."
- They may only be consumed by an **explicit exterior / perimeter-derived
  workflow once that role/path exists** (e.g. a future deterministic step that
  derives `perimeter` from overall length + width with the user's confirmation).
- **Until that path exists, building dims are INFORMATIONAL-ONLY by default.**
- **Acknowledgement stays per-conversion** (never a session-wide "I understand").

Implementation status: `building_informational` already enforces this.
`building_convert` in `confirmation.ts` is the **flagged follow-up** to restrict
so a `building_*` source can never target generic `length` (only the future
perimeter/exterior path). Until that refinement lands, callers must not issue a
`building_convert` to `length`; the end-to-end path below relies only on
legitimately role-confirmed dims, never a building→length conversion.

## What still requires user confirmation
- Any dimension the tagger leaves **untagged** (bare values, ambiguous labels).
- **`building_length` / `building_width` → wall run or perimeter** conversion —
  recognized but never auto-applied.
- **Total wall run itself** when the plan only prints room/overall dims and no
  "wall length/run" label (the common case) — the interior wall layout isn't
  derivable from text alone, so it blocks until measured (geometry path) or the
  user supplies it.
