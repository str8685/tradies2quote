# Plan-reader — rollout & feature flag

> Deploy ≠ release. The plan-reader backend ships to production with the flag
> **OFF**, owner-only, and is widened only after fixture-based evaluation
> proves acceptable behaviour.

## Feature flag

| | |
|---|---|
| **Flag name** | `PLAN_READER_ENABLED` (Vercel env var) |
| **Default state** | **OFF** (unset / not `"true"`) |
| **Code** | `src/lib/planreader/flag.ts` → `planReaderAllowed(email)` |
| **Owner** | Challis Samu — `challis836@gmail.com` (`OWNER_EMAIL` in `src/lib/owner.ts`) |
| **Gated routes** | `POST /api/plans/ingest`, `/api/plans/classify`, `/api/plans/extract` |

### Behaviour

- **Owner** (`OWNER_EMAIL`) is **always** allowed — internal testing in
  production works with the flag still off for everyone else.
- **Everyone else** is allowed **only** when `PLAN_READER_ENABLED=true`.
- A blocked caller gets a **404** (not 403) so the route's existence isn't
  advertised — same posture as the owner-only `/app/agents` and `/app/debug`
  surfaces.
- Unauthenticated callers get **401** (auth check runs before the flag gate).

### Rollout sequence (deploy now, release later)

1. **Now:** code shipped, flag OFF. Owner-only. ← *current state*
2. **Internal:** owner exercises ingest → classify → extract on real plans;
   watch the `[plan-reader]` runtime logs + run `npm run eval:plans`.
3. **Measure:** add real fixtures (`src/eval/fixtures/drawings/`), capture the
   baseline metrics. Do **not** widen access until the numbers are acceptable.
4. **Widen:** set `PLAN_READER_ENABLED=true` in Vercel to open it to all
   authenticated users.

### Cleanup path (when GA and the flag is no longer needed)

1. Confirm `PLAN_READER_ENABLED=true` has soaked with healthy logs + eval
   metrics.
2. Delete `src/lib/planreader/flag.ts` and remove the `planReaderAllowed(...)`
   guard at the top of the three route handlers (leaving them open).
3. Remove the `PLAN_READER_ENABLED` env var from Vercel.

## Observability

Each sheet emits one structured line to the Vercel runtime logs
(`src/lib/planreader/observability.ts`):

```
[plan-reader] {"phase":"classify","file_id":"…","sheet_id":"…","sheet_number":1,
               "sheet_type":"deck","classification_confidence":0.93,
               "gates":["classification:pass"],"final_status":"classified",
               "review_required":false,"errors":[]}
[plan-reader:summary] {"file_id":"…","phase":"extract","total":4,
               "by_status":{"extracted":2,"needs_review":1,"skipped":1},
               "review_required":1,"errored":0}
```

No PII, no image bytes, no quote contents — just type, confidence, gate
verdicts, final status, and non-fatal errors.

## Evaluation harness

- Cases: `src/eval/plan-reader-cases.ts` (hand-labelled ground truth).
- Runner: `src/eval/plan-reader-eval.test.ts` → `npm run eval:plans`
  (gated behind `RUN_PLAN_EVAL=1`; real vision calls; skipped in CI).
- Fixtures: `src/eval/fixtures/drawings/` (per-sheet images; **not committed**).
- Metrics measured (never guessed): classification accuracy, scale-extraction
  success, OCR/dimension quality, required-dims-present rate, per-sheet gate
  outcomes.

## Non-negotiables held

- Six-gate model unchanged; gates combined by OR, never averaged.
- Explicit failure over silent guessing.
- No public rollout without fixture-based evaluation.
- No fake accuracy claims — the harness measures, it doesn't assert a baseline.
