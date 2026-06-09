# Tradies2Quote — Launch Runbook

**You. Friday. The actual things to do, in order, when things work or
break.** Written for a solo founder reading this on a phone at a job
site, not for a 12-person team in a war room.

---

## Before launch (do once, the day before)

- [ ] **OpenAI spend cap** — https://platform.openai.com/account/billing/limits → set monthly cap (e.g. $200) + auto-recharge ON (e.g. recharge $20 when balance < $5).
- [ ] **Anthropic spend cap** — https://console.anthropic.com/settings/billing → same pattern, monthly limit + auto-recharge.
- [ ] **Twilio auto-recharge** (only if you're launching with SMS) — https://console.twilio.com/us1/billing/overview → set trigger + recharge amount.
- [ ] **Email alerts** — at 50% / 80% / 100% thresholds in OpenAI, Anthropic, Resend, Vercel, Supabase dashboards.
- [ ] **Stripe webhook test** — Stripe Dashboard → Webhooks → your `tradies2quote.com/api/stripe/webhook` endpoint → **Send test event** (`checkout.session.completed`) → confirm HTTP 200 response.
- [ ] **Verify `STRIPE_PRICE_ID` in Vercel points to the NZD $49 recurring price** (`price_1Tde4mRxqdsv0POMY81x4XGX`), not the old Missed-Call Rescue one. `vercel env ls | grep STRIPE_PRICE_ID` from `/Users/str8685/Desktop/tradies2quote`.
- [ ] **Sign up as a brand-new tradie yourself** with a throwaway email + your real phone. Record a voice quote. Send it to your own email. Click accept. Did anything break? Fix it now, not Friday.
- [ ] **Backup**: note the current production deploy ID (`vercel ls --prod | head -3`). That's your "known good" — write it down somewhere you can find offline.

---

## Launch day — what to do, hour by hour

### Morning of (before you tell anyone)

- [ ] Open `tradies2quote.com` on your phone. Sign up flow → first quote → send → accept. Smoke test the full loop one final time.
- [ ] Open all 6 monitoring tabs in your browser (keep them open all day):
  1. https://vercel.com/challis-projects/tradies-nz/deployments
  2. https://platform.openai.com/usage
  3. https://console.anthropic.com/settings/billing
  4. https://resend.com/dashboard
  5. https://dashboard.stripe.com/dashboard
  6. https://supabase.com/dashboard/project/guiovuqccbzlbacaxepd/logs/explorer

### First hour after launch

- [ ] Refresh each dashboard every 15 min. Watch for: 5xx errors in Vercel logs, OpenAI/Anthropic spend spikes, Resend bounces.
- [ ] **Your email inbox**: open it. Customers email when things break, not when things work.

### Throughout the day

- [ ] Check the dashboards every hour.
- [ ] If a customer emails, respond within an hour (launch day is when first impressions get cemented).

### End of day

- [ ] Note in a doc: how many signups, how many quotes generated, how many sent, how many accepted, total spend, any errors.
- [ ] Email anyone who signed up but didn't send a quote — *"Hey, saw you signed up, anything I can help with?"* — manual outreach beats automation in week 1.

---

## What to do when things break

### "Customer says they paid but their account still says trial"

- Open Stripe → Customers → find them. Did the payment go through? (Look for green dot, latest charge.)
- If yes — webhook didn't fire or got rejected. Open Stripe → Webhooks → endpoint → check recent attempts. If 4xx/5xx, the signing secret in Vercel doesn't match the endpoint's `whsec_…`. Reveal the secret in Stripe → update `STRIPE_WEBHOOK_SECRET` in Vercel → redeploy.
- Manual workaround while you fix it: in Supabase SQL editor, run `update profiles set subscription_status='active', stripe_subscription_id='<their sub id>' where id='<their user id>'`. Done.

### "Quotes are failing to generate"

- Check OpenAI balance — most likely culprit. https://platform.openai.com/account/billing/overview
- Check Anthropic balance — same.
- If both fine, check Vercel logs: https://vercel.com/challis-projects/tradies-nz/logs?functionPath=/api/quotes/generate

### "Emails aren't being delivered"

- Open Resend dashboard → Emails. Find the one in question. Status will say `delivered`, `bounced`, or `failed`.
- If `bounced`, the customer's email address is wrong. Tell them.
- If `failed`, Resend will show why (usually domain auth issue). Re-verify the sending domain at https://resend.com/domains.

### "Site is down / blank page / 500 error"

This is the panic move. Rollback to the previous deploy:

```bash
cd /Users/str8685/Desktop/tradies2quote
vercel ls --prod      # Note the URL of the deploy you want to roll back TO
vercel rollback <previous-deploy-url> --yes
```

The `<previous-deploy-url>` is the per-deployment hostname like `tradies-xyz.vercel.app`. The production alias (`tradies2quote.com`) flips back to that deploy in ~30s.

Then *figure out what broke*, fix it on `main`, verify the preview deploy, and ship the fix by pushing/merging to `prod-shell` — that's the normal production deploy path (the Vercel GitHub integration deploys `prod-shell` to production automatically; see CLAUDE.md → Deploy model). `vercel rollback` is the emergency tool only.

### "I'm getting hammered with signups / costs spiralling"

- Your spend caps will save you (you set them on launch eve, right?). If OpenAI hits the cap it just stops processing — annoying, not bankrupting.
- If you need to slow signups manually: in Supabase Dashboard → Authentication → Sign-ups → temporarily disable. Existing users still work; new signups blocked.

---

## After-launch week

| Day | Focus |
|---|---|
| Day 1 | Be present. Email new signups personally. Watch dashboards. |
| Day 2-3 | Note every bug + feature request in a single doc. Don't fix during launch week — just collect. |
| Day 4-5 | Trial reminders going out (the lifecycle email system already does this). Watch open + click rates in Resend. |
| Day 7 | First trials expiring. Watch for first paid conversions. Send a personal "you've got 1 day left" email to high-engagement non-converts. |
| Week 2 | Now triage that bug list, fix the top 5. Build the proper BuildOrb monitoring dashboard with real metrics. |

---

## Phone numbers / emails you'll wish you had to hand

- **Vercel support** (Pro plan only) — Dashboard support button. Free plan = community Discord, slower.
- **Supabase support** — https://supabase.com/dashboard/support/new (Pro plan, 24h SLA).
- **Stripe support** — https://support.stripe.com (live chat, ~5 min response).
- **Resend support** — `support@resend.com` (email, ~few hours).
- **OpenAI support** — `help@openai.com` (slow, days).
- **Anthropic support** — `support@anthropic.com` (slow, days).

For anything customer-facing: your own inbox is the support channel. `support@tradies2quote.com` set up via Cloudflare / Resend / wherever you manage your DNS.

---

## The one thing you're going to forget

**Eat. Drink water. Step away from the screen for 10 minutes at lunch.** A solo founder burning out on launch day is the most common failure mode in this whole document. Set a timer.
