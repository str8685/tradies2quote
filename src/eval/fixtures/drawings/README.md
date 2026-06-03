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
