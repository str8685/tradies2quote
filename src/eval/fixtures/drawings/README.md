# Drawing-scan eval fixtures

Drop hand-drawn plan photos here to measure how accurately the AI reads
**shapes** (rectangle / L-shape / triangle / circle / fence line) and their
**measurements**.

## How to add a drawing

1. **Photograph** a hand-drawn plan (a real one off a job is ideal — messy is
   good, that's what the model has to cope with). JPG, PNG, WebP or GIF.
2. **Save it here** as `src/eval/fixtures/drawings/<id>.jpg`.
3. **Measure the truth yourself** — the real area in m² (and perimeter for
   fences/slabs). For an L-shape, split it into rectangles and add them up.
4. **Add a case** to [`../../scan-cases.ts`](../../scan-cases.ts) with that
   ground truth, pointing `image` at your file.
5. **Run it:**

   ```bash
   npm run eval:scan
   ```

## What you get

A per-drawing pass/fail plus overall accuracy:

```
── DRAWING-SCAN EVAL ─────────────────────────────
  ✅ rect-deck-6x4         shape=rect area=24m² perim=20m
  ❌ l-shape-deck          shape=rect area=40m² perim=—m
──────────────────────────────────────────────────
  shape:     4/5 (80%)
  area:      3/5 (60%)
  perimeter: 2/2
──────────────────────────────────────────────────
```

When a shape or area misses, paste the drawing + the `read` line back to me and
I'll tune the scan prompt. The deterministic geometry (area maths) is already
covered by unit tests — this harness measures the **reading**, which is the only
part that depends on the model.

## Notes

- Requires `ANTHROPIC_API_KEY` (shell env or `.env.local`). Each case is a real
  vision call, so it costs a little and isn't deterministic — that's why it's
  gated out of `npm test`/CI and only runs via `npm run eval:scan`.
- Cases whose image file is missing are **skipped**, so the case list in
  `scan-cases.ts` can grow ahead of the photos.
- Real photos are intentionally **not committed** (see `.gitignore` in this
  folder) — they can be large and may contain job/site details.

---

# Plan-reader eval fixtures (multi-discipline)

A second harness lives here for the **plan-reader** flow (classification +
OCR/scale/dimension extraction across deck / floor-plan / foundation sheets).
It shares this folder but uses its own case list and runner.

## How to add a plan sheet

1. **Export ONE sheet per image.** The plan-reader classifies and extracts
   per-sheet, so split a multi-page PDF into page images first (PNG or JPG).
   Save here as `src/eval/fixtures/drawings/<id>.png`.
2. **Read the truth yourself:** the sheet type (`deck` / `floor_plan` /
   `foundation` / `elevation` / `section_detail` / `schedule`), the printed
   **scale** (e.g. `1:100`), the **units**, and a few key dimensions in
   **metres**.
3. **Add a case** to [`../../plan-reader-cases.ts`](../../plan-reader-cases.ts)
   pointing `image` at your file. Leave any field you haven't measured OUT —
   never invent an expected value.
4. **Run it:**

   ```bash
   npm run eval:plans
   ```

## What you get

A measured baseline (not a guess) — per sheet plus overall:

```
── PLAN-READER EVAL ──────────────────────────────
  ✅ deck-rect-6x4    pred=deck(0.93) scale=y ocr=0.88 dims=2/2 → extracted
  gate detail:
    deck-rect-6x4     classification:pass scale:pass ocr:pass required_dims_present:pass ...
──────────────────────────────────────────────────
  classification accuracy:   5/6 (83%)
  scale-extraction success:  4/5 (80%)
  required-dims gate match:   5/5 (100%)
  expected dims found:        7/9 (78%)
  avg OCR confidence:         0.85
──────────────────────────────────────────────────
```

This harness is **informational** — it asserts only that the pipeline ran, and
prints the metrics. It does NOT hard-fail on accuracy until a baseline is agreed
(no fake pass/fail). Cases whose image is missing are skipped, so the coverage
checklist in `plan-reader-cases.ts` can grow ahead of the fixtures.
