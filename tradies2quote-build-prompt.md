# Claude Code Build Prompt — tradies2Quote MVP

## Project Overview
Build **tradies2Quote**, a voice-first AI quoting SaaS for tradies (builders, plumbers, electricians, painters, landscapers, roofers, etc.) globally. Target market: English-speaking tradies in NZ, AU, UK, US, CA.

The core promise: a tradie finishes a site visit, opens the app on their phone, records a 60-second voice memo describing the job, optionally adds photos and text edits, and the app produces a professional, branded quote PDF that's emailed to the client — all in under 90 seconds.

## The User Problem
Tradies currently spend 1-3 hours per quote in Word/Excel/pen-and-paper, often after-hours. They lose jobs because quotes go out late, look unprofessional, or have errors. They lose money because they forget to add markup, GST/VAT, or specific line items. tradies2Quote replaces all of that with a 60-second voice memo.

## Competitive Wedge
Competitors (Tradify, Fergus, simPRO, NextMinute, ServiceM8, AroFlo) are full job-management platforms. They're expensive, complex, and require setup. tradies2Quote is laser-focused on ONE thing: turning a voice memo into a professional quote in 60 seconds. No job pipeline, no time tracking, no scheduling — just quotes done fast.

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + TypeScript
- **Mobile-first PWA** (installable on phones, no native app store needed)
- **Auth & DB**: Supabase (auth, postgres, storage for voice/photo files)
- **Payments**: Stripe (subscriptions)
- **Voice transcription**: OpenAI Whisper API (or Anthropic when available)
- **AI quote generation**: Anthropic Claude API (claude-sonnet-4)
- **PDF generation**: react-pdf or pdf-lib (server-side)
- **Email delivery**: Resend (transactional emails)
- **Hosting**: Vercel
- **Analytics**: Plausible or PostHog (privacy-friendly)

## Multi-Region Support
The app must work for tradies in NZ, AU, UK, US, CA. This means:
- Currency: detected by user country setting (NZD, AUD, GBP, USD, CAD)
- Tax label: GST (NZ/AU), VAT (UK), Sales Tax (US/CA) — user picks during onboarding
- Tax rate: editable, defaults per country (NZ 15%, AU 10%, UK 20%, US 0% editable, CA varies)
- Date format: locale-aware
- Spelling/AI prompt: ask Claude to use the user's country's spelling and trade terminology
- Phone number formats: locale-aware

## Core User Flows

### Flow 1: Onboarding (one-time, 3 minutes)
1. Sign up with email + password (Supabase Auth)
2. Enter business details: business name, ABN/NZBN/UTR/EIN (optional), country, address, phone, email, logo upload
3. Set tax: country defaults but editable
4. Set default labour rate (per hour)
5. Set default markup percentage on materials (e.g. 20%)
6. Optional: import a CSV of common materials with their typical prices, OR start with empty library and add as they go
7. Pick subscription plan (free trial 7 days, no card required)

### Flow 2: Create a Quote (the magic flow — under 90 seconds)
1. Tap "+ New Quote" button (large, thumb-friendly, on home screen)
2. Enter client info: name, address, email, phone (autocomplete from previous clients)
3. Tap big red "Record" button. Tradie speaks for up to 3 minutes describing the job. Real-time transcription shown.
4. Optional: snap up to 5 photos of the job site/materials
5. Tap "Generate Quote" — Claude API receives:
   - The transcribed voice memo
   - Photo descriptions (using vision)
   - The tradie's material library + labour rate + markup % + tax settings
   - The tradie's past quotes (for style/format consistency)
   Claude returns a structured JSON quote with: line items (description, quantity, unit, unit price, line total), labour hours, materials subtotal, labour subtotal, markup, tax, total, suggested terms & conditions, payment terms.
6. Quote preview shown — tradie can edit any line, add/remove items, change quantities, override prices
7. Tap "Send to Client" — generates branded PDF, emails to client with "Accept Quote" button, stores in Supabase
8. Tradie sees the quote in their dashboard

### Flow 3: Client Accepts Quote
1. Client clicks "Accept Quote" link in email
2. Lands on a public quote page showing the full quote
3. Clicks "Accept" — types name and signs (simple canvas signature)
4. Tradie gets instant email + push notification: "[Client] just accepted your quote for [job]"
5. Quote status changes from "Sent" to "Accepted" in dashboard

### Flow 4: Material Library Management
- Tradie can build a library of common materials over time
- Every quote they make adds materials to a "suggested" list
- They confirm prices once, materials become reusable
- Search and add materials to future quotes by name (e.g. "H3.2 90x45 pine" auto-fills)
- Bulk import from CSV

## Pages & Routes

### Public marketing pages (server-rendered for SEO)
- `/` — landing page (see landing page section below)
- `/pricing`
- `/about`
- `/blog` (for SEO content)
- `/quote/[id]` — public quote view for clients (no login needed)
- `/login`, `/signup`, `/forgot-password`

### Authenticated app pages
- `/app` — dashboard (recent quotes, stats, quick actions)
- `/app/quotes` — all quotes list, filterable by status (draft, sent, accepted, declined, expired)
- `/app/quotes/new` — the voice-first quote creation flow
- `/app/quotes/[id]` — quote detail/edit
- `/app/clients` — client list and management
- `/app/materials` — material library
- `/app/settings` — business profile, tax, branding, defaults
- `/app/billing` — Stripe portal

## Landing Page (the marketing page that sells)

### Hero
- H1: "Voice in. Quote out. Under 60 seconds."
- Subheadline: "tradies2Quote turns a voice memo into a professional quote PDF, emailed to your client before you've left the driveway. Built for builders, plumbers, electricians, sparkies, painters, and every tradie who hates writing quotes."
- Primary CTA: "Start Free 7-Day Trial" (no credit card)
- Secondary CTA: "Watch 60-second demo"
- Trust line: "Built by tradies, for tradies. Works in NZ, AU, UK, US, CA."
- Hero visual: phone mockup showing the voice recording screen with waveform, then arrow to a finished quote PDF

### Problem section
- H2: "Stop losing your weekends to quotes"
- Three pain points:
  - "Quotes that take 2 hours to write" — "Most tradies spend 5-10 hours a week on quotes. That's a full day of unbillable work."
  - "Jobs lost to slow responses" — "If your quote takes 3 days, the customer's already accepted someone else's. Speed wins jobs."
  - "Embarrassing typos and missed line items" — "Hand-typed quotes have errors. Errors cost trust. Trust costs jobs."

### How it works (the magic)
- H2: "Three taps. One quote. Done."
- Three steps with icons:
  1. "Record" — Talk for 60 seconds. Describe the job like you would to your apprentice.
  2. "Review" — AI builds your quote with your prices, your labour rate, your tax. Tweak if you need to.
  3. "Send" — One tap. Branded PDF emailed to client with an Accept button. You're already onto the next job.

### Built-for-tradies section
- H2: "Built for tradies, not office workers"
- Two-column grid of features:
  - "Works on your phone, on the job site"
  - "Speaks your trade — H3.2 timber, 25mm copper, 2.5mm² cable"
  - "Auto GST/VAT/Sales Tax for your country"
  - "Your logo, your colours, your terms"
  - "Material library remembers what you charge"
  - "Photos of the job attach to the quote"
  - "Client signs digitally — no printing"
  - "Tracks which quotes are won, lost, or pending"

### Comparison
- H2: "Why not just use Tradify or Fergus?"
- Honest comparison table:
  - tradies2Quote: Quotes in 60 seconds | $29/mo | No setup | Voice-first
  - Tradify/Fergus/simPRO: Full job management | $50-200/mo | Hours of setup | Form-based
- Caption: "If you need full job management, use them. If you just want quotes done fast, use us."

### Pricing
- **Solo** ($29/month) — Unlimited quotes, 1 user, your branding, all core features
- **Crew** ($79/month) — Up to 5 users, shared client database, role permissions — MOST POPULAR
- **Builder** ($199/month) — Up to 20 users, admin dashboard, priority support
- All plans: 7-day free trial, no credit card to start, cancel anytime

### Testimonials section
- Placeholder for 3 testimonials marked [REPLACE WITH REAL] — use real quotes once Challis has 3 beta users

### FAQ
- "Does it work for [my trade]?" — "Yes. Tested with builders, plumbers, electricians, painters, landscapers, roofers, tilers, and more. The AI adapts to your trade vocabulary."
- "What if the AI gets the prices wrong?" — "Every quote is editable before you send. AI is a starting point — you always have final say."
- "Can I import my existing client list?" — "Yes. CSV import on signup."
- "Does it integrate with Xero / MYOB / QuickBooks?" — "Coming in v2. For now, you can export quotes as PDF or CSV."
- "What happens to my data if I cancel?" — "You can export everything anytime. We never delete without your permission."
- "Is voice processing private?" — "Voice memos are transcribed and immediately deleted. We don't store audio files."

### Final CTA
- "Stop writing quotes. Start winning jobs."
- "Start Free 7-Day Trial →"

## SEO Requirements
- Server-side rendered marketing pages (Next.js App Router with default SSR)
- Title, meta description, og:image, og:title for every page
- Schema.org JSON-LD: SoftwareApplication on landing, FAQPage on FAQ section
- Sitemap.xml, robots.txt
- Blog directory at /blog ready for SEO content
- Target keywords: "quoting app for tradies", "voice quote app", "AI quote generator builders", "Tradify alternative"

## Database Schema (Supabase)

```sql
-- Users (managed by Supabase Auth)
-- Profiles
profiles (id uuid pk, business_name, country, address, phone, email, logo_url, default_labour_rate, default_markup_pct, tax_label, tax_rate, currency, created_at)

-- Clients
clients (id uuid pk, user_id fk, name, email, phone, address, created_at)

-- Materials library
materials (id uuid pk, user_id fk, name, unit, default_unit_price, supplier, last_used_at, created_at)

-- Quotes
quotes (id uuid pk, user_id fk, client_id fk, status enum [draft, sent, accepted, declined, expired], voice_transcript text, quote_data jsonb, total_amount numeric, currency, sent_at, accepted_at, signed_name, signed_at, expires_at, created_at)

-- Quote line items (denormalized for speed)
quote_items (id uuid pk, quote_id fk, type enum [material, labour, other], description, quantity, unit, unit_price, line_total)

-- Subscriptions (synced from Stripe)
subscriptions (id uuid pk, user_id fk, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
```

Row-level security: every table scoped to `auth.uid() = user_id`.

## API Routes (Next.js)
- `POST /api/quotes/transcribe` — uploads voice file → Whisper → returns transcript
- `POST /api/quotes/generate` — takes transcript + photos + user settings → Claude API → returns structured quote
- `POST /api/quotes/send` — generates PDF, emails client, marks quote as sent
- `POST /api/quotes/[id]/accept` — public endpoint client uses to accept
- `POST /api/stripe/webhook` — Stripe subscription events
- `POST /api/stripe/portal` — opens Stripe customer portal

## Claude API Prompt for Quote Generation
The system prompt for Claude when generating quotes must:
- Take the voice transcript, photo descriptions, user's country, currency, tax label/rate, default labour rate, default markup, and material library
- Output structured JSON only (no prose)
- Use the user's country's spelling and trade vocabulary (e.g. "spouting" in NZ vs "guttering" in UK)
- Itemize materials with realistic units (each, m, m², kg, hours)
- Add labour as separate line items
- Apply markup to materials but not labour (or per user setting)
- Include reasonable terms & conditions ("Quote valid 30 days", "50% deposit on acceptance for jobs over $5000", etc.)
- If transcript is unclear, generate the quote with placeholders the user can fix, never invent specifics

## Conversion & Activation
- Onboarding wizard with progress bar (so users don't quit at step 3 of 7)
- Sample quote pre-filled in account so user sees the magic before recording their first one
- Email after 24 hours with "Quick start: record your first quote in under 60 seconds" video
- Email after 3 days if no quote sent — offer 1-on-1 onboarding call (Calendly link)
- Trial expiry email: 2 days before, day of, 3 days after

## Mobile UX Priorities
- Bottom tab navigation on mobile (Home, Quotes, New +, Clients, Settings)
- Big thumb-friendly buttons (min 44px tap targets)
- Voice recording works one-handed
- Photos can be taken directly from app, not just uploaded
- Quote PDFs viewable in browser without download
- Works offline for viewing existing quotes (sync when back online)

## Security & Compliance
- All routes auth-protected except marketing pages and public quote view
- Supabase RLS policies on every table
- Voice files deleted after transcription
- GDPR-compliant data export and deletion
- HTTPS only
- Rate limiting on AI generation endpoints

## Out of Scope for V1 (Build Later)
- Job scheduling / pipeline / kanban
- Time tracking
- Invoicing (different doc type)
- Xero / MYOB / QuickBooks integrations
- Multi-language
- White-label / agency tier
- Mobile native apps (PWA covers it for now)
- Live supplier price scraping (Path B from validation chat)
- Team collaboration features beyond basic multi-user

## Deliverable
A complete, deployable Next.js 14 monorepo with:
- All marketing pages (server-rendered, SEO-ready)
- All authenticated app pages
- Supabase schema migrations
- Stripe integration (checkout, webhooks, portal)
- API routes for transcription, AI generation, PDF, email
- Mobile-responsive PWA setup (manifest.json, service worker)
- Environment variable template (.env.example) with all required keys documented
- README with full setup instructions: Supabase setup, Stripe products, Resend domain verification, Vercel deploy
- Seed script with one demo account and 3 sample quotes for development

## Constraints
- DO NOT include live supplier price scraping
- DO NOT build job management / scheduling / time tracking features
- DO NOT use any libraries that aren't actively maintained
- DO use TypeScript strictly (no `any` types)
- DO write code in a way that's easy for one developer to maintain
- Output the full file tree and complete file contents, ready to deploy
