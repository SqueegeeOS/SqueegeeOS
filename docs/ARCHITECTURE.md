# HomeAtlas Architecture

> The world's best luxury home care platform — not a window cleaning CRM.

We are not tracking jobs. We are **documenting the life of a property**.

**Repository:** `squeegeeos` (npm package name). **Platform brand:** HomeAtlas. **First tenant:** SqueegeeKing.  
**Constitution:** [ENGINEERING_BIBLE.md](./ENGINEERING_BIBLE.md) · **Brand rules:** [BRAND.md](./BRAND.md)

---

## Product Modules

```
HomeAtlas (platform)
├── Employee Dashboard        # Daily operations for care team — `/employee`
├── Technician App            # Simple field workflow: arrive → document → finish
├── Member portal             # Luxury portfolio experience per property — `/portal/[token]`
├── Atlas                     # Notes, summaries, scores, recommendations, comms (`lib/concierge/`)
├── Property Timeline         # Chronological story of every visit
├── Membership System         # Tiers, benefits, agreements, portal access
├── Proposal Generator        # Care recommendations → Home Care Plans
├── Photo Library             # Every photo ever taken, per property
├── Annual Home Care Review   # Year-in-review for the home
└── Headquarters              # Founder command center — `/hq`
```

Build incrementally. Every feature must fit naturally into this map.

---

## Product Flow

The end-to-end journey — from first touch to living property archive:

```
Marketing Website
        ↓
Home Care Assessment
        ↓
Homeowner Portal
        ↓
Property Hub
        ↓
Property Dashboard
        ↓
Property Timeline
        ↓
Visits
        ↓
Photos
        ↓
AI Intelligence
```

| Stage | Purpose |
|-------|---------|
| **Marketing Website** | Acquisition — luxury first impression, drive to assessment |
| **Home Care Assessment** | Entry point — evaluate the home, begin the relationship |
| **Homeowner Portal** | Member portal — enrolled homeowner's private care surface |
| **Property Hub** | All properties for a homeowner — choose where to go |
| **Property Dashboard** | Single property's brain — score, status, connected systems |
| **Property Timeline** | Chronological story — every visit, every chapter |
| **Visits** | Atomic field events — technician captures, AI processes |
| **Photos** | Visual archive — every image tied to visits and timeline |
| **AI Intelligence** | Atlas — summaries, scores, recommendations, comms (see [AI_CONCIERGE.md](./AI_CONCIERGE.md)) |

Everything downstream of **Property Hub** is property-scoped. The timeline is the spine; visits and photos feed it; AI enriches it.

**Current routes mapped to flow:**

| Stage | Status | Route |
|-------|--------|-------|
| Marketing Website | Not started | — |
| Home Care Assessment | Not started | — |
| Homeowner Portal (Member portal) | **Built** (token) + demo (slug) | `/portal/[token]` production; `/homecare/.../portal` internal |
| Property Hub | Built | `/properties` |
| Property Dashboard | Built | `/properties/[slug]` |
| Property Timeline | Preview | Dashboard `recentTimeline` |
| Visits | Not started | — |
| Photos | Counts only | Property Hub cards |
| AI Intelligence (Atlas) | Morning Brief shipped; field automation planned | `/hq`, property cards |

---

## Core Data Model

### Homeowner → Properties (one-to-many)

A homeowner may own multiple properties. Each property is **independent** — its own dashboard, timeline, photos, score, and membership context.

**Example: Larry Buckley**

```
Larry Buckley
├── Canyon Oaks Residence
├── Downtown Chico Office
├── Lake Almanor Home
└── Rental Property
```

### Property (the central entity)

Every property contains:

| Domain | Contents |
|--------|----------|
| **Care** | Home Care Score, Membership, Recommendations, Upcoming services |
| **History** | Property Timeline, Visit history, Past proposals |
| **Media** | Photo Library, Before & After photos |
| **Intelligence** | AI summaries |
| **Field** | Technician notes |
| **Records** | Documents, Agreements |
| **Access** | Gate codes / access information |
| **Personal** | Custom notes |

---

## Property Timeline (critical)

Every visit automatically creates a timeline entry. This is the narrative spine of the platform.

Each entry stores:

- Date
- Technician
- Photos
- Notes
- AI summary
- Services completed
- Home Care Score changes
- Recommendations
- Customer-visible summary

The customer portal should feel like **Apple Photos × luxury real estate portfolio** — scroll through years of history, maintenance, recommendations, and improvements. The software tells the **story of the home**.

---

## Technician App

Designed for speed and simplicity in the field:

1. Arrive at property
2. Tap the property
3. Upload photos
4. Check completed services
5. Leave quick notes
6. Press **Finish Visit**

That's it. AI handles the rest.

---

## Atlas (post-visit automation)

When a technician finishes a visit, **Atlas** (platform intelligence layer) will automatically:

- Writes professional notes
- Generates the visit summary
- Updates the Home Care Score
- Updates recommendations
- Generates follow-up email
- Generates follow-up text
- Updates the customer's Home Care Portal

---

## Member Portal

- Luxury, personalized, property-specific — see [BRAND.md](./BRAND.md)
- Not a proposal — a **digital experience** for enrolled members
- Design inspiration: Apple, Lusion, Rolex, Audemars Piguet
- Dark luxury aesthetic, generous spacing, cinematic typography

**Production routing (customer):**

```
/portal/[token]              # Magic-link access — customer emails and onboarding
/portal/[token]/home-health
```

**Demo / internal routing (slug):**

```
/homecare/[homeowner-slug]/[property-slug]/portal
```

Token URLs are unguessable (`memberships.portal_access_token`). Slug routes remain for demos and employee preview — never in customer email.

---

## Employee Dashboard

Operations hub for the care team — members, revenue, visits, pending plans. Premium and spacious; not contractor software. No clutter, no dense tables.

**Route:** `/employee` (public landing is `/`)

**Connected to Property Hub:**

- **Properties** — top-right nav link → `/properties`
- **New Home Care Plan** — primary gold CTA → `/employee/home-care-plan/create`
- **Open Property Hub** — premium secondary card → `/properties`
  - Subtitle: *"Browse properties, timelines, and living archives"*

---

## Navigation Flow (current)

```
/  →  /request  →  (inspection)  →  Home Care Plan  →  Become a Member  →  Member Portal
/employee  →  /properties  →  /properties/[slug]
/request  — lead intake (mock)
/sample plan  →  /homecare/larry-buckley/canyon-oaks-residence/plan
```

**Property slugs (Larry Buckley):**

- `canyon-oaks-residence`
- `downtown-chico-office`
- `lake-almanor-home`
- `rental-property`

---

## Proposal Generator (placeholder)

Per-property Home Care Plan creation — foundation for future proposal generation.

**Route:** `/properties/[slug]/home-care-plan`

**Shows (mock):**

- Property context — name, score, membership, timeline depth
- Planned sections — assessment, score analysis, recommendations, membership options, investment overview, customer presentation
- *"Proposal generation coming soon"*

**Component:** `components/property/plan/home-care-plan-placeholder.tsx` (superseded by create wizard)

### Create Home Care Plan (employee — built, local persistence)

Noah can generate personalized plans from the internal wizard. Plans persist via the **persistence layer** — sessionStorage adapter when Supabase is disabled; Supabase adapter when `NEXT_PUBLIC_SUPABASE_ENABLED=true` (dual-writes to session mirror when cloud is on).

| Entry | Route |
|-------|-------|
| Employee dashboard → **New Home Care Plan** | `/employee/home-care-plan/create` |
| Property dashboard → **Create Home Care Plan** | `/properties/[slug]/home-care-plan` (pre-filled) |

**Wizard steps:** Homeowner → Property → Services & Findings → Notes → Pricing → Generate

**On generate:** `buildHomeCarePlanFromDraft()` → `saveGeneratedHomeCarePlan()` → customer presentation at `/homecare/{homeowner}/{property}/plan`

**Key files:** `components/home-care-plan/create/create-home-care-plan-wizard.tsx`, `lib/home-care-plan/builder.ts`, `lib/persistence/`

`HomeCarePlanExperience` accepts a `data` prop — generated plans use the same flagship design as Canyon Oaks.

---

## Persistence (Supabase-ready)

Adapter pattern — app code calls `lib/persistence/repository.ts`; backend is swappable.

| Adapter | Status | When |
|---------|--------|------|
| `sessionStorageAdapter` | **Default** | When Supabase env not enabled |
| `supabaseAdapter` | **Implemented** | When `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SUPABASE_ENABLED=true` |

Membership onboarding (`complete-sign-onboarding`, portal tokens, signed agreements) **requires** Supabase at runtime.

**Data models** (`lib/persistence/types/`):

| Model | Supabase table |
|-------|----------------|
| Homeowners | `homeowners` |
| Properties | `properties` |
| Home Care Plans | `home_care_plans` (presentation JSON + draft) |
| Memberships | `memberships` |
| Signed agreements | `signed_agreements` |
| Photos & documents | `property_assets` |

**Schema reference:** `lib/persistence/supabase/schema.sql`

Browser roles have no direct `home_care_plans` SELECT authority after migration 036. A cloud customer presentation URL carries the plan row's UUID capability alongside both readable slugs. The server validates all three values, accepts only `generated` or `published` rows, and returns only the matching `presentation` document. The slug-only plan route can read only the originating browser's session copy when cloud persistence is disabled. Legacy cloud slug portal and home-health routes fail closed; the canonical member portal resolves its opaque portal token before any privileged plan, member, or health read.

**Backward compatibility:** Legacy sessionStorage entries (raw `HomeCarePlanData` JSON) are auto-migrated on read. Storage key unchanged: `squeegeeos:hcp:{homeowner}:{property}`.

**To enable Supabase:** Run schema + migrations → set env vars in `.env.local` / Vercel → set `NEXT_PUBLIC_SUPABASE_ENABLED=true`. See `lib/persistence/supabase/schema.sql` and `migrations/`.

---

## People & team content

**All customer-facing people must be real SqueegeeKing team members or clearly marked portrait placeholders. Never stock photos or fictional names.**

| Role | Name | Source |
|------|------|--------|
| Founder & Visionary | Noah Thomas | `lib/team/founders.ts` |
| Co-Founder & COO | Dasan Gramps | `lib/team/founders.ts` |

**Portrait workflow:** Upload to `public/team/{slug}/` (`portrait-desktop.webp`, `portrait-mobile.webp`, `portrait-full.webp`). Components auto-swap placeholders when files exist. See `lib/team/portraits.ts`.

Shared UI: `components/team/` (`FounderPortrait`, `FounderProfileCard`, `MeetTheFounders`).

---

## Design Principles

1. **Property-first** — The home is the hero, not the job ticket
2. **Luxury over utility** — Feel handcrafted, never generic SaaS
3. **Handcrafted over generated** — *"Crafted for [Name]"* moments; homeowners should wonder if we built this for their home alone
4. **Experience over features** — Emotional feeling matters more than information density
5. **Quality over speed** — One unforgettable page beats ten average ones
6. **Timeline as story** — Every visit adds to the property's living archive
7. **AI as invisible craftsmanship** — Automate the tedious; elevate the output
8. **Incremental build** — Ship one module at a time, aligned to this architecture

---

## Google Reviews

Live reviews load from **`GET /api/reviews/google`** (server-only). The client never sees API keys.

| Item | Detail |
|------|--------|
| **Stage 1 (current)** | Google Places API — Place Details (`GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACE_ID`) |
| **Stage 2 (planned)** | Google Business Profile API — owned-business review management, replies, and full review sync |
| **Cache** | 8 hours (`unstable_cache` + route `revalidate`) |
| **Fallback** | Approved client testimonials — clearly labeled, never fake counts |

**Server env vars (never `NEXT_PUBLIC`):**

```
GOOGLE_MAPS_API_KEY=
GOOGLE_PLACE_ID=
```

**Data shape** (`lib/reviews/types.ts`):

```typescript
interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  relativeDate?: string;
  profilePhotoUrl?: string;
  source: "Google";
}
```

**UI:** `components/reviews/google-reviews-section.tsx` fetches `/api/reviews/google` and renders `ReviewsSection`.

### Stage 2 — Google Business Profile API upgrade path

1. Apply for [Google Business Profile API access](https://developers.google.com/my-business/content/prereqs) (requires verified business ownership).
2. Replace `lib/reviews/google-places.ts` fetch with GBP `accounts.locations.reviews.list`.
3. Keep the same `ReviewsData` shape and `/api/reviews/google` contract so the frontend stays unchanged.
4. Benefits: full review corpus, owner responses, review metadata, no 5-review Places preview cap.

---


## Progressive Web App (PWA)

The **Member portal** ships as a **Progressive Web App** — not an App Store download. See [BRAND.md](./BRAND.md).

| Piece | Detail |
|-------|--------|
| **Public site** | `squeegeeking.net` — marketing, assessment, acquisition (infra domain; customer brand is **SqueegeeKing**) |
| **Member PWA** | Scoped to `/portal` — `start_url: /portal`, token resolves via `lib/pwa/portal-session.ts` |
| **Goal** | HomeAtlas icon on the homeowner's phone — native feel, zero App Store friction |

**Design implications for customer-facing pages:**

- Mobile-first layouts; thumb-friendly CTAs (min 52px touch targets)
- `viewport-fit: cover` + safe-area insets (`.portal-safe-area` in `globals.css`)
- Standalone display when installed
- `prefers-reduced-motion` respected on animations

**Implemented:**

| Piece | Location |
|-------|----------|
| Web manifest | `app/manifest.ts` — HomeAtlas branding, `/portal` scope |
| Portal entry | `app/portal/page.tsx` — resolves stored token |
| Token persistence | `lib/pwa/portal-session.ts`, `components/pwa/PortalEntry.tsx` |
| Install prompt | `components/pwa/InstallHomeAtlas.tsx` — token portal only |
| Icons | `public/icons/*.svg` (HomeAtlas **H** mark) |

**Not yet:** service worker, offline shell.

---

## Stripe membership payment (SetupIntent — shipped)

Production onboarding uses **Stripe SetupIntent + Payment Element** — card on file without Checkout redirect.

| Step | Flow |
|------|------|
| Sign | `POST /api/sign-agreement` → agreement PDF, customer email |
| Payment | `CardOnFileSetup` → `StripePaymentSetup` → `confirmSetup` |
| Activate | `POST /api/membership/setup-payment` → membership `active`, welcome email |
| Portal | `portal_access_token` minted at sign; customer opens `/portal/[token]` |

**Key routes:** `POST /api/stripe/setup-intent`, `POST /api/membership/setup-payment`

**Legacy (not production path):** `membership-checkout-modal.tsx` on Home Care Plan page — Checkout redirect (`POST /api/stripe/checkout`) still **not implemented**.

**Gap:** Stripe webhook for `setup_intent.succeeded` not wired — activation is inline after client confirms setup.

**On success:** `markMemberWelcomePending()` → user opens portal → **Unlock Ceremony** (below).

---

## Membership Unlock Sequence

Signature ceremonial moment — welcoming a new member after **payment setup completes**. Not a loading screen.

**Trigger:** `presentation-onboarding.tsx` → `markMemberWelcomePending()` after successful `setup-payment` → first visit to Member portal.

**Ceremony:** `UnlockCeremony` (`components/UnlockCeremony.jsx`) — diamond unlock overlay; see [MOTION_LANGUAGE.md](./MOTION_LANGUAGE.md).

### Accessibility & timing

| Rule | Implementation |
|------|----------------|
| `prefers-reduced-motion` | Skip ceremony; portal loads with welcome copy |
| Skip to portal | Obvious pill button after **1.5 seconds** |
| First activation | Full (~11s) or fast (~5.6s) per `NEXT_PUBLIC_UNLOCK_TIMING` |
| Return visits | **Skip ceremony** — straight to portal |
| Replay | User opt-in from portal: "Watch welcome ceremony again" (always full) |
| Mobile | Lite effects — no SVG noise filter, softer warm light bloom |

### Architecture

| Piece | Location |
|-------|----------|
| Timing, context, welcome copy | `lib/membership/unlock-sequence.ts` |
| Ceremony overlay | `components/UnlockCeremony.jsx` |
| Portal integration | `member-portal-page-client.tsx` |
| Member portal UI | `components/membership/member-portal-experience.tsx` |
| Legacy checkout trigger | `membership-checkout-modal.tsx` (alternate path on Home Care Plan) |

---

## Membership Agreement & Signature (shipped)

Presentation onboarding signs agreements via `POST /api/sign-agreement` → `completeSignOnboarding()`.

| Step | Status |
|------|--------|
| Generate signed agreement PDF | **Shipped** — `lib/agreement/generate-signed-pdf.ts` |
| Save PDF to Supabase storage | **Shipped** — `signed-agreements` bucket |
| Persist `signed_agreements` row | **Shipped** |
| Email PDF to customer | **Shipped** — `send-agreement-email.ts` (requires `RESEND_API_KEY`) |
| Welcome email after payment | **Shipped** — `send-welcome-email.ts` on `setup-payment` |
| Portal access token | **Shipped** — `memberships.portal_access_token` |
| Email to founders / internal copy | Not built |
| Member Portal → Documents UI | Not built — card shows "Coming soon" |

**Legacy mock path:** `saveMembershipAgreementMock` in `lib/membership/agreement.ts` — unused by production onboarding.

---

## Current Implementation Status

| Module | Status | Location |
|--------|--------|----------|
| **Property Hub** (backbone) | **Built** | `/properties`, `lib/property/`, `components/property/` |
| Property Dashboard | **Built** | `/properties/[slug]` |
| Employee Dashboard | **Built** | `/employee` |
| **Public Landing** | **Built** | `/` |
| **Lead Intake** | **Built** (mock submit) | `/request` |
| Proposal Generator / Home Care Plan | **V1** — create wizard, presentation, onboarding | `/employee/home-care-plan/create`, `/homecare/.../plan` |
| Member portal | **Built** (token) + demo (slug) | `/portal/[token]`, `/homecare/.../portal` |
| Technician App | Not started | — |
| Atlas | Morning Brief shipped; field automation planned | `/hq`, `lib/concierge/` |
| Property Timeline | Preview on dashboard | `recentTimeline` mock data |
| Membership System | **Built** — sign, payment, portal token, founding member | `lib/membership/`, presentation onboarding |
| Photo Library | Counts only | Property Hub cards |
| Annual Home Care Review | Not started | — |
| Headquarters | **Built** (PIN + sales tracker) | `/hq` (canonical); `/admin` legacy alias |
| Marketing Website | Not started | — |
| Home Care Assessment | Not started | — |

---

## Headquarters (`/hq`)

Founder command center for **Noah Thomas** and **Dasan Gramps** — executive revenue room with Closed Jobs / Sales Tracker. User-facing name is **Headquarters**, not "Admin" — see [BRAND.md](./BRAND.md).

| Item | Detail |
|------|--------|
| Route | `/hq` (canonical) · `/admin` (legacy redirect if present) |
| Access | Temporary PIN via `NEXT_PUBLIC_ADMIN_PIN` |
| Private beta | If PIN unset → beta entry + mock/local ledger |
| APIs | `GET /api/admin/overview`, `GET|POST /api/admin/closed-jobs` |
| Session | Browser `sessionStorage`, 8-hour TTL |
| Nav | Hidden from public site navigation |

**Security note (required):** PIN gate is private beta only. Replace with Supabase Auth before real customer data is exposed.

### Closed Jobs table

Run in Supabase SQL Editor:

`lib/persistence/supabase/migrations/002_closed_jobs.sql`

Fields: `customer_name`, `property_address`, `sale_amount`, `sale_type`, `recurring_frequency`, `service_category`, `closed_date`, `notes`, `created_by`, `status`, `created_at`.

Without the table, closed jobs save to **browser localStorage** only.

### Legacy vs Operating System

The Command Center distinguishes two histories:

| Layer | Meaning |
|-------|---------|
| **Legacy** | What Noah built before SqueegeeKing OS — honored via baseline (localStorage), never faked |
| **Operating System** | Closed jobs logged since OS launch — forward-only ledger |
| **Company** | Honest sum of Legacy + OS — used for milestones and ARR progress |

Record legacy once via **Honor Your Legacy** in the sidebar. Growth Journey tier **Dynasty** (formerly mislabeled Legacy) is aspirational — company milestones check combined totals and mark **· Legacy** when earned pre-OS.

---

| Feature | Detail |
|---------|--------|
| **CEO Scoreboard** | Revenue collected, ARR, monthly sales performance, lifetime revenue, ARR/monthly goal progress, homes & members protected, business health score (0–100) |
| **Growth Journey** | Four tiers — Foundation, Momentum, Market Leader, Legacy — auto-checked as milestones are earned |
| **Current Mission** | Auto-generated action items from dashboard gaps (AI coaching planned) |
| **Business timeline** | Business started date + days building (localStorage, first visit) |

Manual milestones (employee, truck, multi-city, reviews) unlock when tracked in context — ready for future fields.


Every closed job produces two numbers:

| Metric | Rule |
|--------|------|
| **Immediate Revenue** | `sale_amount` — cash collected at close (one-time and recurring) |
| **ARR Generated** | Annual contract value for recurring memberships only; one-time = $0 |

**ARR multipliers:** Monthly ×12 · Quarterly ×4 · Bi-Annual ×2 · Annual ×1

**Monthly Sales Performance** = Immediate Revenue + ARR Generated (the headline metric Noah celebrates).

Example: $400 one-time + $325 bi-annual membership → Collected $725 · ARR $650 · Performance **$1,375**

### Dashboard filters

`Current Month` · `Last 30 Days` · `Year` · `All Time` — applied to hero metrics, ledger, and closed jobs table. Growth charts use the last 12 months of all closed jobs.

### Monthly ledger columns

Month · Revenue Collected · ARR Generated · Monthly Sales Performance · Jobs Closed · Memberships Sold · Average Ticket · New Customers

| Metric | Rule |
|--------|------|
| Average ticket | Revenue collected ÷ jobs closed in period |
| New customers | Unique customer names in period |
| Close rate | Placeholder until CRM connects |

---

**Current priority:** Operator completeness — first real members through presentation → sign → payment → portal → PWA install. Close operating gaps in wargame 007 (scheduling handoff, documents UI).

Not next: Full Property Timeline, Visits, or field Atlas automation (unless required for first member launch).

---

## Building Forward

Before implementing any feature, ask:

1. Which module does this belong to?
2. Is it scoped to a **property** (not just a homeowner or job)?
3. Does it add to the **Property Timeline** or support it?
4. Does it feel like luxury home stewardship — or like contractor software?
5. Can we ship a thin slice without building the whole system?

If the answer to #4 is contractor software, redesign.
