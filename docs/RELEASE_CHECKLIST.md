# Tradies2Quote — release checklist

Run this checklist on every preview deploy before promoting to
production. Two columns: **Desktop** (Chrome on macOS, browser tab) and
**Mobile** (iOS Safari + Android Chrome). Tick both before clicking
`approve <wave> prod`.

Owner debug page lives at `/app/debug`. Use it to confirm Supabase,
Anthropic, transcription, Resend, and storage all show **ok** before
running the AI-quote flow.

---

## A. Public surfaces

- [ ] `/` loads, splash dismisses within ~2 s, new T2Q mark visible.
- [ ] Theme toggle cycles Auto → Light → Dark → Auto and persists across
      reload.
- [ ] Browser tab favicon is the T2Q mark, not a Vercel triangle or the
      old badge.
- [ ] Browser tab title reads `Tradies2Quote — Voice in. Quote out.
      Under 60 seconds.` on `/`, `Tradies2Quote | Dashboard` on `/app`,
      `Tradies2Quote | Quotes` on `/app/quotes`, etc.
- [ ] Mobile install: iOS Safari → Share → Add to Home Screen — icon
      preview is the new mark. Open the installed app: splash, then the
      app dashboard.
- [ ] PWA manifest icons (`/icon-192.png`, `/icon-512.png`,
      `/maskable-icon-512.png`) all return 200.

## B. Authentication

- [ ] `/login` renders split-screen (form left, marketing right on
      desktop; stacks correctly on mobile).
- [ ] `/signup` renders split-screen.
- [ ] `/forgot-password` renders.
- [ ] Sign-in with a real account lands on `/app`. Hitting `/app`
      while signed out redirects to `/login?next=%2Fapp`.
- [ ] No console errors during login (open DevTools → Console).

## C. Dashboard `/app`

- [ ] "Your numbers" stats panel shows real counts (not 12,847 quotes,
      not $4.2M). For a new account: 0 / 0 / 0 / $0.00 with empty-state
      copy "Live numbers appear after your first quote."
- [ ] "AI Agents" card above the recent quotes navigates to
      `/app/agents`.
- [ ] Tail nav (mobile) shows Clients + Settings (+ Debug if logged in
      as owner). Desktop AppHeader has the same destinations.
- [ ] No "shipped" / "upcoming" / fake activity toasts.

## D. New quote `/app/quotes/new`

- [ ] Voice tab: tap mic → recording timer counts up → tap stop → spinner
      visible while transcription runs.
- [ ] If the transcription API errors, the user stays on the input
      screen, typed text is preserved in the Type tab, and a clear
      error message appears with a "Try again" button.
- [ ] Type tab: typing into the textarea keeps content even when
      switching to Voice tab and back.
- [ ] Click "Continue → Generate quote" → redirects to
      `/app/quotes/preview/[id]` and shows the generator spinner.
- [ ] If AI generation fails, the page shows a clear error (not a
      stuck spinner) with "Try again" + "Edit manually" + "Back to
      dashboard" options.

## E. Quote preview `/app/quotes/preview/[id]`

- [ ] Readiness panel at the top shows banner: "Ready to send" /
      "Needs review" / "Missing required details", with a 12-item
      checklist.
- [ ] Editing client name / address / scope / terms updates the
      readiness panel after save.
- [ ] Materials editor: add a line, set qty + unit price → line total
      computes; save changes succeeds; reload preserves the change.
- [ ] PDF download button works (returns a PDF file).
- [ ] Send quote button works (sends the email; client email is
      required; the form does NOT send when the email field is empty).
- [ ] Public quote URL works in incognito (the `/quote/[token]` route
      renders without auth).

## F. Quote management `/app/quotes`

- [ ] Search by quote number, client name, or job summary filters the
      list as you type.
- [ ] Filter tabs: All / Draft / Sent / Accepted / Declined / Archived.
- [ ] Per-row "⋯" menu shows Archive + Delete (or Restore on archived
      rows).
- [ ] Confirm dialog appears before Archive AND before Delete.
- [ ] Archived rows disappear from the default list, re-appear on the
      Archived filter, and can be restored.
- [ ] Soft-delete: deleted rows disappear from all filters; refresh
      confirms they're gone from the UI. Hard delete is NOT exposed.
- [ ] "Load more" appears below 10 quotes and reveals the next 10.

## G. Settings `/app/settings`

- [ ] Form pre-fills with current profile values (or NZ defaults for a
      fresh account).
- [ ] Saving validates: GST 0–100, labour rate ≥ 0, markup 0–100,
      email format.
- [ ] On success, green "Saved hh:mm" pill appears next to the Save
      button. Reload shows the new values persisted.
- [ ] Sign-out button at the bottom signs the user out and lands them
      on `/`.

## H. Materials `/app/materials`

- [ ] Materials list renders existing rows.
- [ ] "Capture supplier product" CTA opens `/app/materials/capture`.
- [ ] In `/app/materials/capture`: paste a Mitre 10 / Bunnings URL,
      confirm the supplier auto-detects, fill in name + price, GST
      checkbox toggles ex-GST math, save adds the row to the library.
- [ ] "Add material" + "Import CSV" buttons both work.

## I. AI Agents `/app/agents`

- [ ] Six cards (Quote Builder, Voice, Materials, Follow-up,
      Compliance, Admin) — all CTAs navigate to existing pages.
- [ ] Invoice Agent card is disabled with "Coming later".
- [ ] Status board shows Live / Needs setup / Coming later columns,
      no fake "shipped" claims.
- [ ] No agent can send, save, delete, invoice, or email without
      explicit user action.

## J. Debug `/app/debug` (owner only)

- [ ] Loads as owner. As any other authenticated user, returns 404.
- [ ] Services panel shows Supabase ✓ ok, Anthropic ✓ ok, OpenAI ✓ ok,
      Resend ✓ ok (or **missing** with detail if a key isn't set —
      never the key value itself).
- [ ] Build panel shows commit SHA (10 chars), branch, Vercel env,
      Node env.
- [ ] Device panel shows real values for viewport, pixel ratio, theme,
      PWA standalone mode, service-worker availability.
- [ ] No secret values visible anywhere on the page.

## K. Theme + accessibility

- [ ] Switch OS theme to Light while in Auto mode → app follows
      live, even while on `/app/*` pages.
- [ ] Light mode: status pills, warning banners, yellow text all
      readable on cream.
- [ ] Dark mode: same surfaces readable on dark.
- [ ] Reduced-motion: heavy animations stop (set
      `Settings → Accessibility → Reduce Motion` in macOS / iOS).

## L. Error + loading states

- [ ] Force an error (e.g. visit `/app/quotes/preview/bad-id`) → app
      lands on the friendly error page, not a blank screen, and the
      "Try again" + "Back to dashboard" buttons both work.
- [ ] Throttle the connection to Slow 3G; navigate to `/app/quotes` →
      a loading skeleton appears, then the real list.
- [ ] Sign-out, then visit `/app` → redirects to `/login?next=…`
      without a flash of the dashboard UI.

## M. Console + Vercel logs

- [ ] Open browser DevTools → Console while clicking through every
      route above. No red errors. The only acceptable warning is the
      `THREE.Clock` deprecation from a transitive landing-page
      dependency.
- [ ] Vercel dashboard → Deployments → latest preview → Functions →
      Logs: no 500s, no `Error: API_KEY missing` lines.

## N. Cross-project isolation

- [ ] `knockoff.app` is still attached to the `knockoff` Vercel
      project. `vercel alias ls` shows the same two `knockoff.app` +
      `www.knockoff.app` aliases on the older `knockoff-…` deployment.
- [ ] `tradies2quote.com` is attached to a deployment in the
      `tradies-nz` Vercel project.

---

When every item above is ticked: reply to the working session with
`approve <wave> prod`. The owner deploys from the worktree via
`vercel --prod`. Production aliases auto-repoint and the per-deploy
URL stays accessible forever.
