# HomeAtlas Cohesion Map

**Status:** Connective operating map
**Audience:** Noah, founders, engineers, AI coding sessions
**Purpose:** Make the repo feel like one product instead of several promising fragments.

This document does not replace the [Engineering Bible](./ENGINEERING_BIBLE.md),
[Current State](./CURRENT_STATE.md), [Brand Architecture](./BRAND.md), or
[Membership Source of Truth](./operations/MEMBERSHIP_SOURCE_OF_TRUTH.md). It
ties them together and gives every future change a place to land.

---

## The One Sentence

HomeAtlas helps premium home service companies prove care over time by keeping a
truthful, beautiful record of each property.

SqueegeeKing is tenant zero. Headquarters is where founders operate. The Member
portal is where homeowners feel the record. Atlas is the intelligence layer that
notices useful things from verified facts.

---

## The Product Spine

Every important feature should strengthen this loop:

```
lead
  -> Home Care Plan
  -> signed agreement
  -> card on file
  -> active membership
  -> scheduled Jobber visit
  -> documented visit memory
  -> Member portal timeline
  -> Headquarters reconciliation
  -> Atlas next action
  -> referral / review / renewal
```

If a feature does not clearly attach to this loop, it is either a lab, a future
platform idea, or a distraction until the loop is dependable.

The loop's promise is not "window cleaning software." The promise is:

- The homeowner can see what happened to their home.
- The founder can see what was promised, what was scheduled, what was completed,
  and what needs attention.
- The technician can finish the visit without creating office chaos.
- Atlas can summarize and flag only what the system already knows.

---

## Brand Stack

| Name | Role | Primary audience | Rule |
|---|---|---|---|
| **HomeAtlas** | Platform operating system | Operators, future tenants, internal product | Use for platform attribution and operating-system language. |
| **SqueegeeKing** | Tenant zero and customer-facing service brand | Homeowners in the current market | Use on acquisition, Home Care Plans, and member care experiences. |
| **Headquarters** | Founder command center | Noah, Dasan, operators | Never call it "admin" in product copy. It shows operating truth. |
| **Atlas** | Intelligence layer | Internal product, later operators | It observes and explains. It does not invent, decide policy, or perform side effects alone. |

Customer-facing care copy leads with SqueegeeKing. Operator/system copy may say
"Powered by HomeAtlas." Atlas stays quiet until it has useful evidence.

---

## Surface Map

| Surface | Route family | Job in the spine | Cohesion rule |
|---|---|---|---|
| Public acquisition | `/`, `/request`, `/rightway` | Create qualified leads and expectation | Claims must match current operating reality. |
| Home Care Plan | `/presentations/*`, `/homecare/.../plan` | Turn assessment into signed promise | Pricing must come from the Atlas Pricing Engine and signed snapshots. |
| Member portal | `/portal/[token]/*` | Let a member see care, next visit, savings, and memory | Token route is production. Show only verified care; never accounting jargon. |
| Demo/internal portal | `/homecare/[homeownerSlug]/[propertySlug]/portal` | Preview and internal storytelling | Never email slug routes to customers. |
| Headquarters | `/hq/*` | Founder operating truth, diagnostics, reconciliation | If something is inconsistent, HQ should show it instead of smoothing it over. |
| Technician/field | `/tech/*` | Arrive -> document -> finish | A completed visit must leave memory. Speed matters, but truth wins. |
| Setup/integrations | `/setup/*`, admin APIs | Connect Google, Jobber, Stripe, Supabase safely | Integration state is founder-facing; secrets remain server-side. |
| Experience labs | `/experience`, `/day`, `/night`, experiments | Explore motion and ceremony | Freeze during reliability work. Promote only when tied to the spine. |

The same entity should not have two product meanings across surfaces. When a
route has a legacy or demo purpose, label the boundary in docs and navigation.

---

## Systems Of Record

| Truth | Owner | Never substitute |
|---|---|---|
| Homeowner, property, membership, signed agreement, portal token | Supabase authoritative tables | Browser state, screenshots, local storage, route params |
| Membership lifecycle display | `lib/membership/membership-lifecycle-resolver.ts` | Inline status checks per component |
| Pricing formulas and defaults | `lib/pricing/*` Atlas Pricing Engine | UI math, Jobber text, manual override without snapshot |
| Payment method and payment result | Stripe, mirrored in HomeAtlas ledgers | Client success screen or a Supabase boolean alone |
| Appointment/date/dispatch | Jobber during current operating phase | Native schedule guesses or demo rows |
| Visits owed | HomeAtlas obligation ledger / register | Appointment count alone |
| Completed care history | Completed appointment plus documented memory | Fabricated timeline entries or inferred summaries |
| Google review truth | Google APIs / Business Profile | Fake review counts or copied testimonials |
| Customer communication | Logged delivery outcome and approved copy | A provider request accepted without delivery evidence |

The cohesion rule is simple: one owner writes a fact; every other surface reads
or reconciles it.

---

## The Data Story

HomeAtlas has one central entity: the **property**.

```
Homeowner
  -> Property
  -> Presentation / Home Care Plan
  -> Signed agreement
  -> Membership
  -> Jobber appointment
  -> Visit documentation
  -> Property Timeline
  -> Member portal
  -> Headquarters / Atlas
```

This keeps the emotional story and the operational truth aligned:

- A membership is a promise.
- An appointment is a scheduled event.
- A completed visit is observed reality.
- A timeline entry is customer-visible memory.
- A billing charge is money movement.
- A credit or reward is a ledger event, not a marketing flourish.

Do not collapse those concepts to make a screen easier.

---

## Atlas' Place

Atlas is not the product's personality. Atlas is the product's attention.

Today, Atlas should:

- Build deterministic Morning Brief insights from real company data.
- Flag missing setup, stale reviews, unscheduled promises, and inconsistent
  records.
- Draft or summarize only from structured facts and explicit source records.

Atlas should not:

- Invent visits, scores, recommendations, revenue, or review counts.
- Send customer messages without founder-approved workflow.
- Move money, grant credits, waive obligations, or change policy on its own.
- Become a public chatbot before the operating loop is trustworthy.

When Atlas becomes smarter, keep the same contract: facts first, quiet delivery,
founder control.

---

## Current Cohesion Priority

The repository has enough product surface. The next phase is making the spine
dependable.

1. **Reliability gate:** prove migrations, RLS, auth, and server/client
   boundaries against production reality before expanding behavior.
2. **Money and membership idempotency:** refreshes, retries, double-clicks, and
   webhook replays must not duplicate agreements, memberships, charges, credits,
   or rewards.
3. **Jobber truth:** keep Jobber as appointment truth; sync or reconcile into
   HomeAtlas without native scheduling drift.
4. **Obligation ledger:** distinguish visits promised from appointments booked
   so Headquarters can show who is owed care.
5. **Post-visit memory:** every completed visit creates a truthful customer
   chapter: date, technician, work done, observation/photo/recommendation.
6. **Monitoring:** surface protected-read failures, webhook drift, Stripe/DB
   divergence, and stale sync before customers do.
7. **Growth:** once the loop runs twice without contradiction, use referrals,
   real Google reviews, and existing-customer outreach to grow.

Labs, new aesthetics, future tenants, and broad Atlas automation come after the
loop is repeatable.

---

## Cohesion Checks For Any New Work

Before building, answer these:

1. Which step of the product spine does this strengthen?
2. Which system owns the truth this feature reads or writes?
3. Does this create a second definition of price, status, appointment, credit,
   or history?
4. What does the Member portal show, and is it care rather than accounting?
5. What does Headquarters show when the data is missing or inconsistent?
6. Can retry, refresh, or concurrent clicks create duplicates?
7. Does Atlas summarize verified facts, or is it being asked to invent?
8. Which existing doc needs an update if this ships?

If any answer is fuzzy, tighten the existing subsystem before adding surface
area.

---

## Document Routing

Start here for cohesion, then route by task:

| Task | Read next |
|---|---|
| Product law or tradeoff | [ENGINEERING_BIBLE.md](./ENGINEERING_BIBLE.md) |
| What is live right now | [CURRENT_STATE.md](./CURRENT_STATE.md) |
| Route/module ownership | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Membership status or enrollment | [operations/MEMBERSHIP_SOURCE_OF_TRUTH.md](./operations/MEMBERSHIP_SOURCE_OF_TRUTH.md) |
| Pricing | [ATLAS_PRICING_ENGINE.md](./ATLAS_PRICING_ENGINE.md) |
| Brand words and names | [BRAND.md](./BRAND.md) |
| Daily company procedures | [OPERATING_MANUAL.md](./OPERATING_MANUAL.md) |
| Atlas intelligence | [AI_CONCIERGE.md](./AI_CONCIERGE.md) |
| Motion or ceremony | [MOTION_LANGUAGE.md](./MOTION_LANGUAGE.md) |

Unmerged branch notes are useful context, not current authority. Promote them
intentionally before treating them as part of the operating corpus.

---

## The Cohesive Product In One Line

SqueegeeKing does the care, HomeAtlas remembers it, Headquarters reconciles it,
and Atlas notices what needs attention next.
