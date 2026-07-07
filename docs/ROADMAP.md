# HomeAtlas Roadmap

**Last updated:** July 2026  
**Organizing principle:** Ship complete luxury modules — not half dashboards.

Version labels reflect **product maturity**, not semver of the npm package (`squeegeeos@0.1.0`).

**Terminology:** See [BRAND.md](./BRAND.md). Customer member surface = **Member portal** (`/portal/[token]`). Platform intelligence = **Atlas** (`lib/concierge/`).

---

## V1 — Foundation (Current)

*Prove the OS on SqueegeeKing. Founders run the company here.*

### Shipped

| Module | Route / location | Notes |
|--------|------------------|-------|
| **Headquarters** | `/hq` | PIN gate, cloud sync, legacy + OS timelines |
| **Headquarters boot & motion** | `/hq` | Cinematic unlock, Morning Brief, count-ups |
| **Atlas Morning Brief** | `/hq` | Rule-based v0.1 concierge insights |
| **Closed jobs & revenue** | `/hq` | Local + Supabase merge, charts, ledger |
| **Growth journey & missions** | `/hq` | Foundation → Dynasty tiers |
| **Founder onboarding** | `/hq` | Legacy baseline import |
| **Google Reviews (Places)** | API + plans | Live rating via Places API; setup wizard |
| **Google Reviews OAuth** | `/setup/google-reviews` | Business Profile connect + diagnostics |
| **Home Care Plan (flagship)** | `/homecare/.../plan` | Canyon Oaks reference implementation |
| **Plan create wizard** | `/employee/home-care-plan/create` | Draft → generate → persist |
| **Member portal** | `/portal/[token]`, `/homecare/.../portal` (demo) | Token magic-link (production); slug routes internal/demo. Wallet card, home dashboard, founding member, install prompt, unlock ceremony. Implements [BRAND.md](./BRAND.md) Member portal. |
| **Secure portal access** | `/portal/[token]` | Unguessable `portal_access_token` per membership; customer emails never use slug URLs. |
| **Membership onboarding** | Presentation flow | Sign agreement → PDF + email → card on file (SetupIntent) → welcome email → portal. |
| **Membership unlock ceremony** | Portal flow | Triggered after payment setup; `UnlockCeremony` on first portal visit. |
| **Property Hub** | `/properties` | Multi-property homeowner view |
| **Property Dashboard** | `/properties/[slug]` | Score, timeline preview, modules |
| **Employee dashboard** | `/employee` | Operations entry |
| **Request plan intake** | `/request` | Squeegee transition on submit |
| **Public landing** | `/` | Acquisition entry |
| **Experience Lab** | `/experience` | Ceremony previews (PIN) |
| **Persistence layer** | `lib/persistence/` | Session adapter default; Supabase adapter implemented — active when `NEXT_PUBLIC_SUPABASE_ENABLED=true`. Membership onboarding requires Supabase. |
| **HomeAtlas branding** | Platform surfaces | Powered by HomeAtlas, Morning Brief |
| **PWA (member portal)** | `app/manifest.ts`, `app/portal/` | Manifest scoped to `/portal`; install prompt in token portal; no service worker yet |

### V1 Known Gaps (in progress or blocked)

| Gap | Blocker / next step |
|-----|---------------------|
| HQ Supabase table manual migration | Run `003_headquarters_profile.sql` in SQL Editor |
| GBP API business list | Google Basic API Access approval (~7–10 days) |
| Production `GOOGLE_PLACE_ID` | Wrong place until reconnect / share-link fallback |
| Stripe Checkout redirect | Not used — live path is SetupIntent + Elements. `/api/stripe/checkout` still unbuilt (legacy modal only). |
| Stripe webhook | `setup_intent.succeeded` not wired — activation is inline via `/api/membership/setup-payment` |
| Member portal documents UI | Agreements stored; portal Documents card still "Coming soon" |
| Technician app | Not started |
| Full property timeline | Preview data only |

---

## V1.1 — Operator Completeness

*Target: Q3–Q4 2026. Make founders never leave Headquarters for truth.*

| Feature | Description | Status |
|---------|-------------|--------|
| **Google Business Profile live** | Post-approval OAuth list + Place ID auto-connect | Planned |
| **Stripe membership (HQ MRR)** | MRR rollup in Headquarters from live memberships | Planned — payment capture via SetupIntent shipped |
| **Signed agreement PDF** | Generate, email, store in portal documents | **Partial** — PDF + customer email shipped; portal Documents UI not built |
| **Welcome email** | Post-payment portal CTA with membership checklist | **Shipped** — `send-welcome-email.ts` on `setup-payment` |
| **Supabase cloud default** | Closed jobs + HQ profile fully cloud-synced | Adapter shipped; env toggle still required |
| **Request pipeline** | `/employee/requests` connected to real intake | Planned |
| **Reviews reply (GBP)** | Owner responses from HQ (Stage 2 reviews) | Planned |
| **Atlas Morning Brief v1.1** | More rules, reputation + membership depth | Planned |
| **Install PWA flow** | Add to Home Screen for members | **Partial** — `InstallHomeAtlas` in token portal |
| **Sound layer (optional)** | Subscribe to `homeatlas:sound` events | Planned |

---

## V2 — Field & Intelligence

*Target: 2027. The visit loop closes.*

| Module | Description |
|--------|-------------|
| **Technician App** | Arrive → photos → services → notes → Finish Visit |
| **Property Timeline (live)** | Every visit creates timeline entry automatically |
| **Photo library** | Per-property archive tied to visits |
| **Atlas (field intelligence) v1** | Post-visit notes, summary, score update, customer email draft |
| **Home Care Assessment** | Structured acquisition beyond `/request` mock |
| **Marketing website** | Full public site — not landing-only |
| **Annual Home Care Review** | Year-in-review homeowner experience |
| **Atlas copilot v1** | LLM-backed Morning Brief + operator Q&A (PIN-gated) |
| **Multi-property portal** | Larry Buckley multi-home fully routed |

---

## Future — Platform & Category

*2028+ — curated multi-tenant HomeAtlas*

| Initiative | Description |
|------------|-------------|
| **Tenant onboarding** | Second home service company on HomeAtlas |
| **White-label customer surfaces** | Partner brand, HomeAtlas powered-by |
| **Headquarters per tenant** | Isolated founder dashboards |
| **Marketplace integrations** | QuickBooks, ServiceTitan import, etc. (evaluate carefully) |
| **Homeowner referral loop** | Portal-native share, neighbor invite |
| **Atlas autonomous ops** | Proactive scheduling, churn prevention, anomaly alerts |
| **Hardware / Vision** | AR property walkthrough (research — not committed) |

---

## Explicitly Not on Roadmap

- Generic CRM feature parity chase
- App Store native apps (PWA first)
- Marketplace for cheapest bid
- Public AI chatbot on marketing site
- Light mode (dark luxury is the brand)

---

## How to Propose a Feature

1. Map it to [ARCHITECTURE.md](./ARCHITECTURE.md) module list.
2. State which version bucket (V1.1 / V2 / Future).
3. Name the **homeowner feeling** and **founder outcome**.
4. If it changes motion, brand, or concierge scope — list doc updates required.

---

## Status Legend (for ARCHITECTURE.md tables)

| Label | Meaning |
|-------|---------|
| **Built** | Production-quality, in use |
| **Prototype** | Real UI, mock or partial backend |
| **V1** | Functional but incomplete |
| **Not started** | Spec only |

---

*When shipping a roadmap item, move it to **Shipped** under the appropriate version and date-stamp this file.*
