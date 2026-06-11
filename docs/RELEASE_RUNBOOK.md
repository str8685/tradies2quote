# Release + rollback runbook

**Status:** canonical for the hardened-RC campaign (2026-06). Pairs with
`docs/RELEASE_CHECKLIST.md` (the per-deploy manual QA list) and LAUNCH.md.

## The one production path

1. **Ref to deploy:** the reviewed release SHA on `main` (CI green — the
   `lint-and-test` check is a required status check on `main`).
2. **Production branch:** `prod-shell` (Vercel Production Branch). It does
   not currently exist on origin — a release (re)creates it at the release
   SHA:
   ```
   git push origin <RELEASE_SHA>:refs/heads/prod-shell
   ```
   Plain push, no `--force`: Git rejects it if the branch unexpectedly
   exists and diverges. The Vercel Git integration builds and promotes;
   `tradies2quote.com` + `tradies-nz.vercel.app` auto-repoint.
3. **Never** `vercel --prod` for routine shipping (undocumented second path).

## Env flag posture expected at deploy

| Flag | Production | Preview |
|---|---|---|
| `T2Q_WEATHER_PLANNING` / `NEXT_PUBLIC_…` | **absent (off)** | `1` |
| `T2Q_WEATHER_IMPACT` | default-on (no var) | default-on |
| `DEBUG_INTERNAL_OBSERVABILITY` | absent | absent (re-add ad hoc) |
| `STRIPE_PAYMENTS_WEBHOOK_SECRET` | real secret | dummy (testing aid) |
| `CRON_SECRET` | real secret | preview-scoped value |

Enabling weather planning in production is a **separate, explicit decision**
— never bundled silently with a code deploy.

## Before promoting (manual)

- CI green on the release SHA (enforced).
- `docs/RELEASE_CHECKLIST.md` sections A–N walked on the release preview.
- Mobile shell: 4-state checklist (`docs/mobile-shell-contract.md`) on a
  real installed-PWA iPhone — splash, dashboard nav, long scroll, installed
  mode — plus the account-sheet scroll-lock open/close cycle.
- `/api/health` on the preview returns the release commit.

## After promoting (smoke, ≤10 min)

- `https://tradies2quote.com/api/health` → 200 + the new commit sha.
- `/` 200, `/login` 200, `/app` unauth → 307 to login.
- Sign in on a phone browser: dashboard renders, bottom nav flush, open a
  quote → review renders (Review Guard notice only if something stripped),
  send gate behaves.
- `/app/debug` services panel all ok (owner).
- Watch `app_error_groups` (owner /app/debug dashboard) for new groups for
  ~30 min.

## Rollback

Per-deployment URLs are immutable — every previous production deployment
stays serving forever (verified this campaign: `08742f2` and `01f5c08`
prod deployments both still `READY`).

1. **Instant:** Vercel dashboard → tradies-nz → Deployments → previous
   production deployment → **Promote to production** (or CLI:
   `vercel rollback`). Aliases repoint in seconds; no build.
2. **Code-level:** push the previous good SHA to `prod-shell`
   (`git push origin <PREV_SHA>:prod-shell`, with `--force-with-lease` if
   the branch advanced) — triggers a rebuild of the old code.
3. **DB note:** migrations in this campaign are additive-only (new tables /
   enum value / RPC). Rolling back code never needs a schema rollback.
4. After rollback: re-run the smoke list above against the old build, then
   diagnose in preview.

## CI gates enforced (proof: branch protection on `main`)

`lint-and-test` runs ESLint + the full vitest suite, which includes the
regression packs: deck-leak, insulation exterior-only (orchestrator AND
strict legacy), weather job-location, freshness, shell contract, sheet
scroll-lock, totals integrity, Review Guard / Quote QA contradictions,
client-error scrubbing, rate-limit. A red check blocks the branch (admin
direct-push bypass retained for the solo workflow — discipline: never push
red).
