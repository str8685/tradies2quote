# Plan-driven takeoff → Review Quote: required inputs & recovery

How the deterministic (no-guess) material takeoff behaves when dimensions are
missing, and exactly how to recover from the Review Quote screen. Nothing here
guesses dimensions, materials, or prices.

## Required inputs per line type

Calculators are deterministic: a quantity is produced ONLY from real inputs.
Missing a required input → the line is **blocked** ("X takeoff — needs dimensions
before it can be quoted", qty 0), never a guess.

| Line type | Required to calculate | Supply at scan | Supply at Review Quote |
|---|---|---|---|
| **Framing** | total wall length (m) **and** wall height (m); stud spacing optional (300/400/450/600) | marker `wall_run_m` + `height_m` (+ `stud_spacing_mm`) | Takeoff assumptions panel |
| **Lining / GIB** | wall area (m²) **or** (length + height) | marker dims | Takeoff assumptions panel |
| **Insulation** | exterior wall area (m²) **or** (length + height); exterior-only via `exterior_wall_run_m` | marker dims | Takeoff assumptions panel |
| **Concrete** | (length + width) **or** volume (m³) | marker dims | manual qty / remove (v1) |
| **Fixing** (skirting/architrave) | run length (m) **or** perimeter (m) | marker dims | manual qty / remove (v1) |
| **Wall** (legacy bundle) | wall length + wall height + GIB sides | marker `wall_run_m` + `height_m` | Takeoff assumptions panel |
| **Deck** | deck length (m) **and** width (m) | marker dims | manual qty / remove (v1) |

(Required-input rules: `src/lib/takeoff/validate.ts`. Wall family math:
`src/lib/materialCalculator.ts`.)

## What happens when inputs are missing

- Each missing-dimension scope produces ONE **blocked** line (`takeoff_status:
  "blocked"`), qty 0, no price.
- The Review Quote line now shows a **visible** plain-language guide under the
  badge (not a hover tooltip): e.g. *"Framing needs: total wall length (m) and
  wall height (m). Enter dimensions in 'Takeoff assumptions' above and tap
  Recalculate, type a quantity below to keep it as a manual line, or remove it."*
  (`src/lib/takeoff/blockedLineGuide.ts`).
- A blocked line **hard-blocks sending** until recovered. The send error reports
  the blocked lines (actionable) before the empty-quote error.

## Recovery paths (from Review Quote — no guessing)

1. **Wall family (framing / lining / insulation):** open **Takeoff assumptions**,
   enter total wall length + wall height (+ stud spacing / GIB sides), tap
   **Recalculate Materials**. The deterministic calculator runs and **replaces**
   the blocked lines with calculated quantity lines. Prices stay **blank** — you
   enter them manually (count-first; no library auto-pricing).
2. **Any blocked line (incl. concrete / fixing / over-routed lines):** type a
   real quantity into the line's **Qty** field — it converts to a **manual line
   you own** (clears the blocked state), or hit the **Remove** (trash) button if
   the line shouldn't be there. No dimension fields for those scopes in v1.

Prefill rule: the Takeoff assumptions panel prefills only from your own frozen
takeoff inputs (and labelled editable defaults like 2.4 m height) — never an AI
guess of a missing required dimension (wall length prefills empty).

## Send-gate behavior (smarter, not removed)

- **Hard block** when: any line is still **blocked** (missing info), or the quote
  is **genuinely empty** (no line carries a real quantity).
- **NOT a hard block** when: a line has a real quantity but a **$0 price** (the
  manual-pricing default). That surfaces as an **acknowledgeable warning**
  ("N line(s) quote at $0") — you can save the draft freely and send after
  acknowledging. Sending still prompts you about unpriced lines.
- `total_zero` ("Add at least one line with a quantity before sending") now fires
  only when genuinely empty — not merely because prices are $0.

(Send gate: `src/lib/quote-validation.ts`.)

## Hard rules preserved

No guessing of dimensions/materials; no silent defaults for required inputs;
calculators derive quantities only from real inputs; pricing stays manual
(`unit_price`/`line_total` = 0 by default, `PRICES_OFF=true`); a quote can't be
sent while required dimensions are missing; the review screen prefills only with
your own prior answers.
