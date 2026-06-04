# tradies2Quote — Build Environment Setup

Follow these steps in order. Once done, you're ready to build with the right skills loaded, the right tools dialled in, and a clean foundation.

Estimated setup time: 60-90 minutes.

---

## Step 1: Install the core tools (15 mins)

If you don't already have these:

**Node.js 20+** — required for Next.js
- Download: https://nodejs.org/ (LTS version)
- Verify: `node --version` should show v20 or higher

**Git** — for version control
- Download: https://git-scm.com/
- Verify: `git --version`

**VS Code** — code editor
- Download: https://code.visualstudio.com/
- Install these extensions: Tailwind CSS IntelliSense, ES7+ React snippets, Prettier

**Claude Code CLI** — Anthropic's coding agent
- Install: `npm install -g @anthropic-ai/claude-code`
- Verify: `claude --version`
- Login when prompted with your Anthropic account

---

## Step 2: Set up your accounts (20 mins)

You'll need accounts for the services tradies2Quote uses. Sign up now so you have keys ready.

**Required:**

1. **Supabase** (database + auth + storage) — https://supabase.com
   - Create a new project called `tradies2quote-prod`
   - Save: Project URL, anon key, service role key

2. **Stripe** (payments) — https://stripe.com
   - Create account, complete business verification (use STR8 Studio details)
   - Toggle to Test mode for now
   - Save: publishable key, secret key

3. **Anthropic API** (AI quote generation) — https://console.anthropic.com
   - Create API key, name it `tradies2quote`
   - Add $20-50 credit to start

4. **OpenAI API** (Whisper for voice transcription) — https://platform.openai.com
   - Create API key
   - Add $10-20 credit (Whisper is cheap, ~$0.006/min)

5. **Resend** (transactional email) — https://resend.com
   - Sign up, verify your sending domain (you'll need DNS access)
   - Save: API key
   - Recommend buying a dedicated sending domain like `mail.tradies2quote.com`

6. **Vercel** (hosting) — https://vercel.com
   - Sign up with GitHub
   - Free tier is fine to start

7. **Domain** — buy `tradies2quote.com` or `.io` if available
   - Namecheap, Porkbun, or Cloudflare Registrar
   - Cost: ~$15-50/year

**Optional but recommended:**

8. **PostHog or Plausible** — analytics
9. **Sentry** — error tracking (free tier)
10. **GitHub** — code repository (free for private repos)

---

## Step 3: Create the project (5 mins)

Open your terminal:

```bash
# Create project folder
mkdir tradies2quote
cd tradies2quote

# Initialize git
git init

# Create the Next.js app (when prompted, choose: TypeScript yes, Tailwind yes, App Router yes, src directory yes)
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"

# Initial commit
git add .
git commit -m "Initial Next.js setup"
```

---

## Step 4: Install the right Claude Code skills (15 mins)

This is the part most people skip. Don't.

Open Claude Code in your project folder:

```bash
cd tradies2quote
claude
```

Once Claude Code is running, install the official Anthropic skills marketplace:

```
/plugin marketplace add anthropics/skills
```

Then install the skills that matter for tradies2Quote:

```
/plugin install document-skills@anthropic-agent-skills
/plugin install example-skills@anthropic-agent-skills
```

This gives you:
- **frontend-design skill** — makes UI production-grade, not generic AI slop
- **pdf skill** — for generating quote PDFs (your core output)
- **docx, xlsx skills** — useful for client exports later
- **mcp-builder skill** — for adding integrations later

Verify they loaded:
```
/plugin
```

You should see the skills listed under the Discover tab.

**Optional (if you want even better UI):**

Add the third-party UI skills marketplace:
```
/plugin marketplace add https://skillhub.club/marketplace.json
```
Browse and install `ui-ux-pro-max` if you want extra design polish. (Optional — frontend-design from Anthropic is usually enough.)

---

## Step 5: Set up your environment file (5 mins)

Create `.env.local` in your project root:

```bash
# Supabase  (NOTE: the code reads the PUBLISHABLE key name, not ANON_KEY)
NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_key_here

# Stripe (optional — without it everyone stays on trial; no publishable key
# is used, checkout is a server-side redirect)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# AI
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...           # only needed for voice transcription

# Email (both required to send quotes)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=quotes@mail.tradies2quote.com

# App  (set to https://tradies2quote.com in prod or accept links break)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Crons (weekly digest + trial emails) — any random secret
CRON_SECRET=any_long_random_string

# Error monitoring (optional but recommended; without it errors are silent)
NEXT_PUBLIC_SENTRY_DSN=
```

Add `.env.local` to `.gitignore` (it should be already, but check).

---

## Step 6: Stage your build prompt (5 mins)

Save the build prompt I gave you earlier as `build-prompt.md` in your project root. This becomes your reference doc — you'll feed sections of it to Claude Code, not the whole thing at once.

---

## Step 7: Build in this exact order (the next 2-4 weeks)

This is where most people fail — they ask Claude Code to build everything at once. Don't. Build in chunks, test each, commit, move on.

**Week 1 — Foundation**

Day 1-2: Marketing landing page
- Prompt Claude Code: "Using the frontend-design skill, build the marketing landing page for tradies2Quote based on the landing page section in build-prompt.md. Server-rendered, SEO-ready, mobile-first."
- Test on mobile and desktop
- Deploy to Vercel — get a live URL today

Day 3-4: Auth + database
- Prompt: "Set up Supabase auth (email/password) and create the database schema from build-prompt.md. Add /login, /signup, /forgot-password pages. Add /app dashboard route protected by auth."
- Test signup → login → logout flow
- Commit

Day 5: Onboarding wizard
- Prompt: "Build the multi-step onboarding wizard from Flow 1 in build-prompt.md. Save profile data to Supabase."
- Test full onboarding end-to-end

**Week 2 — The magic flow (voice → quote)**

Day 6-8: Voice recording + transcription
- Prompt: "Build the voice recording UI using the MediaRecorder API. Upload audio to /api/quotes/transcribe which sends to OpenAI Whisper and returns transcript."
- Test on your actual phone, not just desktop

Day 9-11: AI quote generation
- Prompt: "Build /api/quotes/generate. Takes transcript + photos + user settings. Calls Claude API (claude-sonnet-4) with the system prompt from build-prompt.md. Returns structured JSON quote."
- Test with 3-4 real quote scenarios you'd write for STR8 Builders

Day 12: Quote editor UI
- Prompt: "Build the quote review/edit UI. User can edit any line item, add/remove lines, save as draft."

**Week 3 — Send + receive**

Day 13-14: PDF generation
- Prompt: "Using the pdf skill, generate branded quote PDFs from the quote data. Include user's logo, business details, line items, totals, terms."
- Test PDF output looks professional

Day 15-16: Email + client accept flow
- Prompt: "Build /api/quotes/send to email PDF via Resend with an Accept Quote button. Build public /quote/[id] page where client can view and accept with digital signature."
- Test full flow: tradie creates quote → emails to your other email account → opens email → accepts quote → tradie sees notification

Day 17-18: Stripe subscriptions
- Prompt: "Add Stripe subscriptions with the 3 tiers from build-prompt.md. Add /api/stripe/webhook and /app/billing pages. 7-day free trial without credit card."
- Test full payment flow with Stripe test cards

**Week 4 — Polish + launch prep**

Day 19-20: Material library + clients management
- Build /app/materials and /app/clients

Day 21-22: Testing on real STR8 Builders jobs
- Use it for 3 actual quotes for STR8 Builders
- Fix every awkward thing you hit

Day 23-24: Launch prep
- Privacy policy, terms of service (use a generator)
- Meta tags, og image, favicon
- Switch Stripe to live mode
- Point domain at Vercel

Day 25: Launch to your 3 builder mates
- Send them the link, free 3-month access
- Watch them use it (literally, sit with one of them)
- Note every confusion, every dropped step

Day 26+: Iterate based on feedback before paid launch

---

## Step 8: The rules you must not break

These are the difference between shipping and joining the unfinished pile:

1. **Commit to git after every working feature.** Not at end of day — after every win.
2. **Deploy to Vercel by end of day 1.** Live URL on real domain. Don't wait.
3. **Never ask Claude Code to "build the whole app."** Always specific, scoped chunks.
4. **Test on your actual phone, not just desktop.** Tradies use phones.
5. **Use it for real STR8 Builders quotes from week 3.** Eat your own dog food.
6. **Don't add features not in the build prompt during week 1-3.** Scope creep is the killer.
7. **If something's broken for more than 2 hours, ship a workaround and move on.** Perfect is the enemy of launched.
8. **Set a daily 90-minute build window.** Same time every day. Showing up beats marathon sessions.

---

## Step 9: Track progress visibly

Create a simple `progress.md` file in your project root. At end of every build session, write:
- What I shipped today
- What broke
- What I'll do tomorrow first thing

This sounds boring. It's the single highest-correlation habit with finished projects.

---

## Step 10: When you hit a wall

You will. Everyone does. Here's the order to try:
1. Read the error message slowly
2. Ask Claude Code to debug with full context
3. Search the exact error on Google + GitHub Issues
4. Ask in the relevant Discord (Next.js, Supabase have great ones)
5. Come back to me with: what you tried, what error you're seeing, what you expect to happen

Don't quietly stop building. That's how projects die. Stuck = signal to ask, not signal to abandon.

---

## You're ready

You now have:
- The right tools
- The right accounts
- The right skills loaded into Claude Code
- A clear build sequence
- The build prompt as your reference

The only thing left is to start. Open your terminal tomorrow morning, type `cd tradies2quote && claude`, and prompt the landing page.

Day 1, ship the landing page live. That single act puts you ahead of 90% of people who plan SaaS products and never launch.

Go build. Message me when you ship the landing page or hit a wall.
