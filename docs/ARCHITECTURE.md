# SqueegeeOS Architecture

> The world's best luxury home care platform — not a window cleaning CRM.

We are not tracking jobs. We are **documenting the life of a property**.

---

## Product Modules

```
SqueegeeOS
├── Employee Dashboard        # Daily operations for care team
├── Technician App            # Simple field workflow: arrive → document → finish
├── Customer Home Care Portal # Luxury portfolio experience per property
├── AI Engine                 # Notes, summaries, scores, recommendations, comms
├── Property Timeline         # Chronological story of every visit
├── Membership System         # Tiers, benefits, agreements
├── Proposal Generator        # Care recommendations → proposals
├── Photo Library             # Every photo ever taken, per property
├── Annual Home Care Review   # Year-in-review for the home
└── Admin Dashboard           # Configuration, users, system oversight
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
| **Homeowner Portal** | Homeowner's view — their properties, membership, experience |
| **Property Hub** | All properties for a homeowner — choose where to go |
| **Property Dashboard** | Single property's brain — score, status, connected systems |
| **Property Timeline** | Chronological story — every visit, every chapter |
| **Visits** | Atomic field events — technician captures, AI processes |
| **Photos** | Visual archive — every image tied to visits and timeline |
| **AI Intelligence** | Layer across all — summaries, scores, recommendations, comms |

Everything downstream of **Property Hub** is property-scoped. The timeline is the spine; visits and photos feed it; AI enriches it.

**Current routes mapped to flow:**

| Stage | Status | Route |
|-------|--------|-------|
| Marketing Website | Not started | — |
| Home Care Assessment | Not started | — |
| Homeowner Portal | Prototype | `/homecare/larry-buckley`, `/homecare/.../portal` |
| Property Hub | Built | `/properties` |
| Property Dashboard | Built | `/properties/[slug]` |
| Property Timeline | Preview | Dashboard `recentTimeline` |
| Visits | Not started | — |
| Photos | Counts only | Property Hub cards |
| AI Intelligence | Mock status | Property cards & dashboard |

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

## AI Engine (post-visit automation)

When a technician finishes a visit, AI automatically:

- Writes professional notes
- Generates the visit summary
- Updates the Home Care Score
- Updates recommendations
- Generates follow-up email
- Generates follow-up text
- Updates the customer's Home Care Portal

---

## Customer Home Care Portal

- Luxury, personalized, property-specific
- Not a proposal — a **digital experience**
- Design inspiration: Apple, Lusion, Rolex, Audemars Piguet
- Dark luxury aesthetic, generous spacing, cinematic typography
- Each property gets its own independent experience

**Target routing (evolution):**

```
/homecare/[homeowner-slug]/[property-slug]
```

Current prototype: `/homecare/larry-buckley` (single-property preview)

---

## Employee Dashboard

Operations hub for the care team — members, revenue, visits, pending plans. Premium and spacious; not contractor software. No clutter, no dense tables.

**Route:** `/`

**Connected to Property Hub:**

- **Properties** — top-right nav link → `/properties`
- **New Home Care Plan** — primary gold CTA (global; not yet routed)
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

Noah can generate personalized plans from the internal wizard. Plans persist via the **persistence layer** — sessionStorage adapter active now; Supabase adapter ready but not connected.

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
| `sessionStorageAdapter` | **Active** | Now — browser-local, same keys as before |
| `supabaseAdapter` | Stub | After keys + `NEXT_PUBLIC_SUPABASE_ENABLED=true` |

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

**Backward compatibility:** Legacy sessionStorage entries (raw `HomeCarePlanData` JSON) are auto-migrated on read. Storage key unchanged: `squeegeeos:hcp:{homeowner}:{property}`.

**To connect Supabase later:** Run schema → add `@supabase/supabase-js` + client → implement `supabaseAdapter` → set env vars. No Supabase keys in repo yet.

---

## People & team content

**All customer-facing people must be real Squeegeeking team members or clearly marked portrait placeholders. Never stock photos or fictional names.**

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

## Google Reviews (future integration)

Live reviews will replace mock data in `lib/reviews/mock-data.ts`.

| Priority | API | Use case |
|----------|-----|----------|
| **Primary** | Google Business Profile API | Squeegeeking's own reviews (requires API access approval) |
| **Fallback** | Google Places API — Place Details | Public rating + review preview |

**Data shape** (`lib/reviews/types.ts`):

```typescript
interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  profilePhotoUrl?: string;
  source: "Google";
}
```

**UI:** `components/reviews/reviews-section.tsx` accepts `ReviewsData` — swap mock for `fetchSqueegeekingReviews()` when API is connected (`lib/reviews/fetch-reviews.ts`).

---

## Progressive Web App (PWA)

Squeegeeking will ship as a **Progressive Web App** — not an App Store download.

| Piece | Plan |
|-------|------|
| **Public site** | `Squeegeeking.net` — marketing, assessment, acquisition |
| **Member experience** | Logged-in Home Care Plan & homeowner portal |
| **Onboarding** | Team guides homeowners through **Add to Home Screen** during onboarding |
| **Goal** | Squeegeeking app icon on the homeowner's phone — native feel, zero App Store friction |

**Design implications for all customer-facing pages:**

- Mobile-first layouts; thumb-friendly CTAs (min 52px touch targets)
- `viewport-fit: cover` + safe-area insets for iPhone notch/home indicator
- Standalone display (`display: standalone`) when installed
- Fast load, responsive images (`sizes` on every `next/image`)
- `prefers-reduced-motion` respected on animations
- Feels like an app, not a website in a browser tab

**Implemented (foundation):**

| Piece | Location |
|-------|----------|
| Web manifest | `app/manifest.ts` → `/manifest.webmanifest` |
| Theme color | `#060606` via `viewport.themeColor` |
| App icons (placeholder) | `public/icons/*.svg`, `app/icon.tsx`, `app/apple-icon.tsx` |
| Apple Web App | `appleWebApp` metadata in root layout |
| PWA config | `lib/pwa/config.ts` |

**Not yet:** service worker, offline shell, install prompt UI, Add to Home Screen onboarding flow.

---

## Stripe Checkout (membership — future)

Become a Member flow is designed for **Stripe Checkout redirect** — no card data collected in-app.

| Step | Now | When Stripe is live |
|------|-----|---------------------|
| 1–3 | Plan, agreement, signature | Same |
| 4 | Checkout preview (not active) | Explains redirect |
| 5 | Confirm → `createMembershipCheckoutSession()` | Redirect to `checkout.stripe.com` |

**Stripe Checkout handles:** card on file, initial payment, recurring billing.

**Integration:** Set `STRIPE_CHECKOUT_ENABLED` in `lib/membership/types.ts`, implement `POST /api/stripe/checkout`, map plan IDs to Stripe Price IDs in `lib/membership/plans.ts`.

**On success:** Do not show a loading spinner or inline welcome in the checkout modal. Close the modal and trigger the **Membership Unlock Sequence** (below).

---

## Membership Unlock Sequence

Signature ceremonial moment — welcoming a new member into the SqueegeeKing family after successful Stripe Checkout. Not a loading screen. Not a web animation — an exclusive club unlock.

**Design intent:** Apple product reveal · luxury automotive delivery · opening a Rolex box. Slow, confident, cinematic. Brushed chrome lock, crown key, mechanical unlock, soft white light escape, camera push forward.

### Sequence

| Phase | What happens |
|-------|----------------|
| 1 | Stripe Checkout succeeds |
| 2 | Screen fades to black |
| 3 | High-detail chrome padlock appears — brushed silver, machined depth |
| 4 | Crown key approaches head-on (no sideways glide) |
| 5 | Key inserts and rotates — mechanically correct |
| 6 | Satisfying mechanical click (Web Audio) |
| 7 | Shackle releases; soft white light escapes from keyhole |
| 8 | Camera subtly pushes forward; light radiates outward |
| 9 | *"Welcome to the SqueegeeKing Family."* |
| 10 | *"Your home is now under our care."* |
| 11 | White handoff → Member Portal with staggered privilege cards |

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
| Member privileges copy | `lib/membership/member-privileges.ts` |
| Mechanical click | `lib/membership/unlock-sound.ts` |
| Chrome lock & crown key | `components/membership/unlock/chrome-padlock.tsx`, `crown-key.tsx` |
| Full overlay | `components/membership/unlock/membership-unlock-sequence.tsx` |
| Privilege cards | `components/membership/member-privilege-card.tsx` |
| Provider & trigger | `components/membership/unlock-provider.tsx` |
| Member Portal | `components/membership/member-portal-experience.tsx` |
| Checkout trigger | `membership-checkout-modal.tsx` → `beginMembershipUnlock()` |

**Production:** After Stripe redirect return (`?session_id=`), verify session server-side, then trigger the same unlock sequence before routing to the portal.

---

## Membership Agreement & Signature (future production)

Signature step supports **typed** or **drawn** signatures (canvas pad, mobile-friendly). Mock save only — no PDF, email, or storage yet.

**Data layer:** `lib/membership/types.ts` (`MembershipSignature`, `MembershipAgreementRecord`), `lib/membership/agreement.ts` (`saveMembershipAgreementMock`).

**When membership completes (after Stripe Checkout success):**

| Step | Action |
|------|--------|
| 1 | Generate signed agreement PDF |
| 2 | Save PDF to property documents |
| 3 | Save signature image |
| 4 | Persist signed timestamp, IP/user metadata, plan, property, customer name |
| 5 | Email signed agreement to Noah / Squeegeeking |
| 6 | Email signed agreement to customer |
| 7 | Store in Member Portal → Documents |

**Not connected:** PDF generation, property document storage, email delivery, Member Portal documents UI.

---

## Current Implementation Status

| Module | Status | Location |
|--------|--------|----------|
| **Property Hub** (backbone) | **Built** | `/properties`, `lib/property/`, `components/property/` |
| Property Dashboard | **Built** | `/properties/[slug]` |
| Employee Dashboard | **Built** | `/employee` |
| **Public Landing** | **Built** | `/` |
| **Lead Intake** | **Built** (mock submit) | `/request` |
| Proposal Generator | **V1** + create wizard + membership checkout + unlock sequence | `/employee/home-care-plan/create`, `/homecare/.../plan`, `/homecare/.../portal` |
| Customer Home Care Portal | Prototype + Member Portal landing | `/homecare/larry-buckley`, `/homecare/.../portal` |
| Technician App | Not started | — |
| AI Engine | Mock status only | Property cards & dashboard |
| Property Timeline | Preview on dashboard | `recentTimeline` mock data |
| Membership System | Status badges only | Property Hub cards |
| Photo Library | Counts only | Property Hub cards |
| Annual Home Care Review | Not started | — |
| Admin Command Center | **Built** (PIN + sales tracker) | `/admin`, `closed_jobs` table |
| Marketing Website | Not started | — |
| Home Care Assessment | Not started | — |

---

## Admin Command Center (`/admin`)

Private owner page for **Noah Thomas** and **Dasan Gramps** — executive revenue room with Closed Jobs / Sales Tracker.

| Item | Detail |
|------|--------|
| Route | `/admin` |
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

### Revenue model (per closed job)

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

**Current priority:** Home Care Plan V1 production quality — polished enough for Noah to send to a real customer. Then PWA manifest + Add to Home Screen onboarding.

Not next: Timeline, Visits, or AI (unless required for V1 launch).

---

## Building Forward

Before implementing any feature, ask:

1. Which module does this belong to?
2. Is it scoped to a **property** (not just a homeowner or job)?
3. Does it add to the **Property Timeline** or support it?
4. Does it feel like luxury home stewardship — or like contractor software?
5. Can we ship a thin slice without building the whole system?

If the answer to #4 is contractor software, redesign.
