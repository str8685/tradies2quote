# Beta testing — supplier scans & drawing quotes

A small real-world loop. Mates run real scans, send back a 5-line report,
Challis logs them. The app already records the technical result (status,
reasons, rejected rows, corrected flag) — this doc just adds the human bits
and points at where to read the rest.

---

## 1. For mates — what to test

You're testing two things:
- **Supplier quote scan** — photograph a merchant quote (ITM, PlaceMakers,
  Bunnings, Mitre 10…) → app reads the line items.
- **Drawing scan** — photograph a hand-drawn plan → app works out materials.

Do a scan, look at the quote it produced, then send Challis the
**5-line report** below. A photo of what you scanned + the quote number
(`Q-2026-XXXX`) helps heaps.

### Supplier quotes — try a spread
- [ ] A clean, flat, well-lit quote (printed or typed)
- [ ] A blurry / angled / shadowed photo
- [ ] A quote with one smudged or hard-to-read price
- [ ] A quote with **no subtotal/total** printed, or the bottom cut off
- [ ] A quote with **freight or discount** lines
- [ ] A long quote (15+ lines)
- [ ] GST-inclusive vs GST-exclusive pricing

### Drawings — try a spread
- [ ] A clear deck plan with dimensions **and** a scale
- [ ] A **big** deck (8 m × 6 m or larger) → expect "confirm key dimensions"
- [ ] A rough sketch with **no scale**
- [ ] A messy / ambiguous drawing
- [ ] Different jobs: deck, subfloor, wall framing, cladding

### The 5-line report (send this per test)
```
1. Scope:        e.g. 8x6 Kwila deck  /  ITM framing quote
2. Source:       drawing  |  supplier quote
3. Result:       ok  |  needs_review  |  blocked  |  corrected
4. What was wrong: (anything the app got wrong, or "nothing")
5. Usable to send? yes  |  no  |  only after I fixed it
   (+ quote number Q-2026-____ and a photo of the source if you can)
```

What the result words mean (the app will show these):
- **ok** — read clean, quote looked right.
- **needs_review** — app flagged it, wanted a human to check before sending.
- **blocked** — app wouldn't let it send until something was fixed.
- **corrected** — you edited/completed it to make it right.

---

## 2. What to record per test (the summary)

Five fields — that's it:

| Field | Example |
|---|---|
| **Scope** | "8×6 Kwila deck", "ITM framing quote 19 lines" |
| **Source type** | drawing / supplier quote |
| **Result** | ok / needs_review / blocked / corrected |
| **What was wrong** | "missed 1 line", "read 2400 as 2.4", "nothing" |
| **Final quote usable?** | yes / no / after fixes |

(Optional but handy: quote number, supplier, photo of the source.)

---

## 3. For Challis (owner) — read the result fast in-app

Most of the above is already captured automatically:

- **Supplier scans → `/app/debug/extraction`** (owner-only review queue)
  Shows each flagged scan's status, the reasons, the **rejected rows with the
  raw text the AI read**, reconciliation status, attempts, and a
  **Mark handled** button. Clean scans don't appear (only needs_review /
  blocked). The metrics strip up top = scans by status, retry rate,
  correction rate, by supplier.
- **Any quote → `/app/debug?quote=<id>`** (Quote trace)
  Shows blocked vs sendable, the exact block reasons, dimension-confirmation
  state, and whether totals tie out.
- **Compact metrics** also live on `/app/debug` with a link to the queue.

So for each test you usually only have to hand-record **scope** and
**usable?** — the rest you can read off those two screens.

---

## 4. Beta log (owner fills in)

Copy a row per test.

| Date | Tester | Scope | Source | Result | What was wrong | Usable? | Quote # |
|------|--------|-------|--------|--------|----------------|---------|---------|
|      |        |       |        |        |                |         |         |
|      |        |       |        |        |                |         |         |
|      |        |       |        |        |                |         |         |

---

## 5. After ~10–15 tests — what to look for

- Open `/app/debug/extraction` metrics: needs_review / blocked counts, retry
  rate, correction rate, and the by-supplier spread.
- Look for **patterns** in "what was wrong" — same supplier failing, same
  misread (e.g. mm vs m), same drawing type.
- Turn recurring **real** failures into golden fixtures so they're locked
  forever: drop a sanitised payload in
  `src/lib/materials/__fixtures__/supplier-scans/` and add it to
  `supplier-fixtures.test.ts`. (That's the only "build" step worth doing from
  beta — everything else is just watching the queue.)

---

_Owner-only data. Source images aren't stored — provenance is each rejected
row's captured raw text, shown in the review queue._
