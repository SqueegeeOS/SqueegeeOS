# WARGAME 003 — Customer Portal Redesign

**Status:** PLAN ONLY. No code changed. Design battle plan for Jerry to execute later.
**Mission:** Make the portal feel like the *continuation of the presentation* — the customer signed inside a keynote; they should land inside the same world, not a different app.
**Hard dependency:** Wargame 001 Phase 5 (portal privacy tokens). Do not invest design effort into a page that is still public-by-guessable-slug. If 001-P5 hasn't shipped, it ships first or together.

---

## Part 0 — The doctrine, translated from the deck

The presentation redesign established a concrete, already-shipped vocabulary. Jerry reuses it; he does not invent:

| Deck principle | Portal translation | Existing implementation to reuse |
|---|---|---|
| Lit stage | Same environment layer on every portal screen: top radial accent glow + `motion-grain` at ~0.03 | `presentation-viewer.tsx` environment divs; `.motion-grain` in `globals.css` |
| Communicate before explain | Every screen has ONE serif headline that answers "what's my situation?" before any data renders | `HeroText` pattern: Cormorant, `-0.015em`, `text-balance` |
| Fewer words, stronger hierarchy | Eyebrow (0.3em tracking, accent/80) → headline → one support line → cards. Nothing else at top level | `Eyebrow` in `slide-primitives.tsx` |
| Progressive disclosure | Numbers and documents live behind "View details" expanders, exactly like the Investment slide's breakdown | `ExpandLink` in `visual-primitives.tsx` |
| Motion = arrival | Sections materialize (rise + blur→0, `spring.glass`), staggered 70ms; reduced-motion collapses to fade | `lib/motion/system.ts`: `materialize`, `staggerDepth` |
| Trust through clarity | Real data or honest emptiness. **Never fabricated history** (see the global blacklist) | — |
| 5–8 second rule | Every section passes the Grandma Test standalone; the landing screen passes it for the whole portal | Wargame verification (Part 4) |
| Loading | Shimmer skeletons shaped like the section, never text-alone, never spinners | `ShimmerBlock` |
| Mobile-first | Design at 375px, enhance up; 52px touch CTAs; safe-area insets | Close-slide CTA pattern |

**The one-sentence brief Jerry pins above his desk:** *the deck sold a promise; the portal is the receipt that keeps proving it.*

---

## Part 1 — Section-by-section battle plan

### 1. First impression after login (the landing moment)

- **Feel:** "I'm home. They know my house. Everything is handled." The same emotional register as the cover slide — because it literally *is* the cover slide, continued: wordmark → their name → their home.
- **Headline idea:** `{FirstName}, {PropertyName} is under care.` One line. Serif. Everything else is subordinate.
- **Data needs:** first name, property name/address, membership status, next-visit date (nullable). All present in `getMemberPortalDataBySlugs` (`lib/persistence/queries/member-portal.ts`).
- **Behind details:** everything. The landing screen shows at most: headline, status chip, next-visit line, and 3–4 navigation cards (Membership, Visits, Documents, Home). No stats grid, no savings counters, no charts on first paint.
- **Empty/failure state:** if portal data fails to load but the plan exists → render the headline from plan data alone with a quiet "Some details are still syncing" line — never an error wall in the member's face. If nothing loads: the graceful not-found (already exists: `MemberPortalNotFound`).
- **Never show:** loading spinners; "backend/cloud/Supabase" words (the `PERSISTENCE_UI_COPY` strings like "Local Storage Only" are founder-facing — they must not leak here); another homeowner's data (slug-collision guard — verify identity fields match the token's record, not just the slug).
- **First-ever login only:** the unlock ceremony already handles the arrival moment (`unlock-sequence`). The landing screen is what exists *after* — do not re-celebrate on every visit (Motion Language: success exits, then gets out of the way).

### 2. Membership status

- **Feel:** certainty. Like a passport, not an invoice.
- **Headline idea:** `Quarterly Member` (the tier *they bought*, in the language of the deck) + `since {month year}`. The wallet-card visual (`member-wallet-card.tsx` exists) is the centerpiece — one object, not a settings table.
- **Data needs:** `memberships.sales_tier`, `plan_name`, `started_at`, `status`, `visit_price`, `visits_per_year`. All in the memberships row.
- **Behind details:** per-visit price, annual math (`$X × N visits = $Y/year` — reuse the agreement math-row format), add-on discount %, billing schedule ("billed on the 1st of your service month — nothing at the door," the same three ✓-bullets from the close slide, verbatim; this copy already lives in `lib/agreement/agreement-content.ts`).
- **Empty/failure:** membership `pending_payment` → this is a *designed* state, show it with the same calm: headline `Almost there.` + one CTA "Finish setting up your card" (routes to the existing activation flow). Never an error tone — it's a doorway, not a defect.
- **Never show:** the legacy tier names **Essential / Premium / Elite** anywhere. The customer bought "Quarterly" or "Bi-Annual" — the portal's current math paths (`inferMembershipTierId`, `MEMBERSHIP_TIERS`) can label people "Premium," which they never purchased. This is the #1 trust-breaking artifact in the current portal (RECON R3). Also never: `status` enum raw values, internal plan IDs (`preferred`), Stripe IDs.

### 3. Next visit

- **Feel:** anticipation with zero effort required. "It's on the calendar; I do nothing."
- **Headline idea:** `Next visit — {Month day}.` If a real appointment exists. The single most valuable line in the portal; it earns the recurring price.
- **Data needs:** `member_appointments` rows (`getMemberPortalDataBySlugs` already returns `nextAppointment`). Technician name if assigned.
- **Behind details:** the rest of the year's schedule (list, month labels — the ScheduleList visual pattern from the deck), what happens on a visit (the 4-step ProcessTimeline, reused verbatim from the deck — same icons, same copy).
- **Empty/failure:** **no fabricated dates, ever.** If no appointment row exists: `We're scheduling your first visit.` + "You'll get a text and email when it's booked — nothing to do." That sentence *is* the product promise. Support line: expected cadence from their tier ("Quarterly members are visited every 3 months").
- **Never show:** the output of `buildMemberAnnualSchedule` (`lib/membership/member-schedule.ts:84`). It invents completed visits and dates. It currently feeds the portal when appointment data is absent. **Ripping this out is the first implementation move of the whole redesign** — a member seeing invented history is the anti-deck. Also never: internal scheduling states ("pending" as a word — say "being scheduled").

### 4. Signed agreement

- **Feel:** "my paperwork is safe and I can always reach it." A document vault the size of one card.
- **Headline idea:** `Your agreement.` Card shows: plan name, signed date, one button: **View PDF** (52px).
- **Data needs:** `signed_agreements` row (via `listSignedAgreementsByProperty` or the portal query): `plan_name`, `signed_at`, `agreement_pdf_url` / storage path.
- **Behind details:** signature method + signed-at timestamp; prior agreements if any (list, newest first).
- **Empty/failure:** if the agreement row exists but the PDF fetch fails: `Your signed agreement is on file — we'll re-send your copy.` + a "Request a copy" action (mailto/SMS to the company, not a broken retry loop). Agreement row missing entirely for an active member = data problem: show "on file" copy anyway and alert founders (log), never show the member an inconsistency.
- **Never show:** the raw signature image (`signature_image_url` is a base64 PNG in the DB — rendering it invites "why do you have my signature stored?" anxiety; it lives inside the PDF where it belongs); IP address / user agent metadata (it's on the row — it is forensic data, not member content); a public bucket URL if 001-P2 shipped (serve through a server route minting signed URLs — that route is a Jerry deliverable here).

### 5. Payment method

- **Feel:** control without exposure. Stripe-grade: quiet, precise, boring in the best way.
- **Headline idea:** `Visa ···· 4242` + `Billed on the 1st of your service month.` Two lines, done.
- **Data needs:** **RECON R1 — card brand/last4 are not in the database.** Memberships store only `stripe_customer_id` / `stripe_payment_method_id`. Displaying "Visa ···· 4242" requires a server route calling `stripe.paymentMethods.retrieve` (cache it; card details change rarely). Never fetch Stripe from the client.
- **Behind details:** "Update card" — mints a fresh SetupIntent via the existing `/api/stripe/setup-intent` flow (already supports `membershipId`); billing philosophy line; next billing month derived from next scheduled visit.
- **Empty/failure:** no payment method on an active membership (the F5 orphan state from wargame 002): `Add your card to complete your membership` + CTA into the activation flow. Stripe API unavailable: show `Card on file ✓` without brand/last4 (the membership row proves existence) — degrade to less detail, never to an error.
- **Never show:** full card anything (we never have it — keep it that way), Stripe customer/intent IDs, charge history (none exists — billing is per-visit future work; do not scaffold a fake "invoices" section), the word "Stripe" (say "secured card on file").

### 6. Property Memory (the home's profile)

- **Feel:** "they know my home like a specialist knows a patient." This is the section that makes the portal *theirs* — the "Crafted for this home alone" moment.
- **Headline idea:** `{Property name}.` with the address as support line, and 2–4 quiet facts: sq ft, home type, member-since, care tier. A portrait of the house, not a form.
- **Data needs:** `properties` row (name, address, sqft, type), `property_details` JSON, hero image if any (`property_assets` where `is_primary`).
- **Behind details:** service preferences/notes *authored for the member's eyes* (RECON R2: `service_notes` and `preferred_products` on the property row — audit whether current content is internal shorthand or member-appropriate before displaying), observations from `service_observations` reframed as "what we're watching" — max 3, newest.
- **Empty/failure:** no photo → a fine-line house illustration (the deck's `HouseIllustration` exists — same asset, continuity for free) on the accent-tinted panel from the Included slide. No details → show only what's known; never "N/A" grids.
- **Never show:** **`access_instructions` (gate codes, lockbox, alarm notes).** Until real per-member auth exists, the portal is a token link that can be forwarded, screenshotted, or leaked — secrets stay out, full stop. This overrides any "it's their own data" argument. Also never: internal severity labels on observations ("critical/moderate" → translate to calm language or omit), AI/quote-engine internals, `home_care_score` *numbers* unless founders decide scores are a customer concept (RECON R4 — the score exists in data but a bare "72" invites anxiety, not trust; if shown, it needs the health-check narrative frame, not a number chip).

### 7. Visit timeline (the archive spine)

- **Feel:** the home's story accumulating. Apple Photos "Memories," not a service log.
- **Headline idea:** `The story of {property} so far.` Entries are chapters: date (month-year, serif), what was done (✓-list, deck vocabulary), one photo if any, one-line note.
- **Data needs:** completed `member_appointments` + `service_observations` + `property_assets` linked by visit. **RECON R5:** there is no unified `visits` table — the timeline must be assembled from appointments(status=completed) as the spine. Confirm what real completed-visit data will exist at launch (likely: none — see §9).
- **Behind details:** each entry expands: full service list, technician, notes, photos grid. Collapsed = one line + thumbnail.
- **Empty/failure:** see §9 — the empty state IS the launch state and gets designed first.
- **Never show:** fabricated entries (same blacklist as §3 — `buildMemberAnnualSchedule`'s invented "completed" items must never reach this surface); internal technician notes not written for customers (RECON R2 applies — the notes field needs a customer-visible flag before anything auto-renders; until then, curated/empty beats leaky); gaps dressed up as visits (if a visit happened but wasn't documented, show the visit with "photos coming" — never backfill fiction).

### 8. Photos & recommendations

- **Feel:** photos = proof and pride ("that's *my* house looking its best"). Recommendations = a concierge's quiet suggestion, never an upsell ambush.
- **Headline idea:** Photos: `{Property}, cared for.` Recommendations: `Worth considering.` — max **one** recommendation surfaced at a time (progressive disclosure of the sales motion itself; a list of upsells reads as a menu of charges).
- **Data needs:** `property_assets` (kind=photo, category before/after); recommendations source is **RECON R6** — no recommendations table exists yet (AI engine is roadmap). Launch reality: recommendations come from founder-authored entries or nothing. Design the slot; do not scaffold fake AI.
- **Behind details:** full gallery grouped by visit; recommendation detail = what/why/price *range* with member discount noted (pricing must come from the pricing engine + live settings — wargame 001 Phase 7 rules apply to any number shown here).
- **Empty/failure:** Photos: `Your home's gallery begins with your first visit.` over the house illustration. Recommendations: **render nothing** — an empty recommendations section ("no recommendations") reads as either neglect or relief; omission is cleaner.
- **Never show:** stock photos (Bible law), other properties' photos (asset queries must filter by property_id — verify against the slug-collision failure mode), prices computed from `DEFAULT_COMPANY_SETTINGS` if live settings diverge, "AI recommends" framing (Atlas is invisible craftsmanship — recommendations come from "your care team").

### 9. Empty states before first visit — **design this FIRST**

- **Strategic fact:** for the first months of real operation, *every* member lives here: signed, card on file, zero visits, zero photos, zero history. The empty portal is not an edge case — **it is the product at launch.** Jerry designs the empty portal as the primary deliverable and treats populated states as the enhancement.
- **Feel:** anticipation, not absence. A reserved table, not an empty room.
- **The one headline idea for the whole empty portal:** `Your home's story starts {next-visit month / soon}.`
- **Per-section empty lines (write once, use verbatim):**
  - Next visit: `We're scheduling your first visit — you'll hear from us, nothing to do.`
  - Timeline: `Chapter one begins with your first visit.`
  - Photos: `Your home's gallery begins with your first visit.`
  - Savings/value: hide entirely until ≥1 transaction (a "$0 saved" counter is an argument against the membership).
  - Recommendations: omit (see §8).
- **What IS full on day one (lead with these):** membership status, agreement, payment method, property profile. The empty portal is therefore: identity + membership certainty + "what happens next" — which is exactly the close slide's promise, replayed. Continuity achieved by construction.
- **Never show:** progress bars to nowhere, "0" statistics, skeleton shimmer as a *permanent* state (shimmer means loading; emptiness means a designed empty card — conflating them makes the portal feel broken).

### 10. Mobile experience

- **Feel:** an app from the home screen (the PWA is the strategy — `Add to Home Screen` is in the onboarding plan). One-handed, thumb-driven, calm.
- **Structure:** single column, sections in the §1 order, each section = one full-width card; sticky bottom nav only if sections exceed one scroll depth (prefer scroll + anchor over tabs — fewer chrome pixels, more stage).
- **Rules (all already proven in the deck):** 52px touch targets; `env(safe-area-inset-bottom)` on any fixed chrome; `m-auto` centering (not flex-center — the deck's scroll-clipping lesson); text sizes from the deck's mobile tier; `[text-wrap:balance]` on headlines; motion identical but stagger tightened (mobile reveals fewer items per viewport).
- **Data discipline:** the portal query (`getMemberPortalDataBySlugs`) already returns everything in one call — keep it that way; one fetch, sections hydrate together, shimmer once. No per-section fetch waterfalls on cellular.
- **Never show:** hover-dependent affordances (every ExpandLink needs visible tap affordance), horizontal scrollers for critical data, desktop tables squeezed (the tier-comparison table pattern is presentation-only; portal uses stacked cards).

---

## Part 2 — Global NEVER-SHOW blacklist (applies to every section)

1. **Fabricated visit history** — `buildMemberAnnualSchedule` output. Removal is move #1.
2. **Legacy tier vocabulary** — Essential/Premium/Elite, `inferMembershipTierId` labels, `MEMBERSHIP_TIERS` pricing. Portal speaks only Quarterly/Bi-Annual.
3. **Access secrets** — `access_instructions`, gate codes, alarm details (until real auth).
4. **Forensics** — IP, user agent, raw signature image, client session IDs.
5. **Internals** — Stripe/Supabase/Atlas/HQ words; storage-backend copy; status enums; internal severity labels; debug states.
6. **Prices not from the pricing engine + live settings** (001-P7 discipline).
7. **Other customers' anything** — every query filters by the token's resolved property_id, never by name-derived slug alone.
8. **Zero-statistics** — "$0 saved", "0 visits", empty counters.
9. **Spending framed as spending** — "amount invested," "you've spent," lifetime totals, `yearToDateInvested` (live violation in `lib/membership/member-schedule.ts` — it computes and surfaces exactly this). Confirmed against THE_HOMEATLAS_STANDARD **Law 004 — Never Punish the Customer With Data**: the portal shows care history, never accounting. Savings framing ("saved with membership") remains allowed once real; spend framing never is.

*(Post-Standard note: this blacklist is now grounded — items 1 and 8 are Law 001, item 9 is Law 004, item 5 is Law 005/Guideline 004. The Standard's 3.4.2 "Product Rules" independently mandates most of this list; treat 3.4.2 as the authority where wording differs.)*

---

## Part 3 — RECON NEEDED (Jerry resolves before building)

| # | Item | Why it gates |
|---|------|--------------|
| R1 | Card brand/last4 display: confirm server route + caching approach for `stripe.paymentMethods.retrieve` | §5 headline is impossible without it |
| R2 | Audit actual content of `service_notes`, `preferred_products`, `service_observations` rows — internal shorthand or member-safe? Is a "customer_visible" flag needed? | §6/§7 leak risk |
| R3 | Map every current portal consumer of legacy tier math (`member-home-dashboard-data.ts`, `member-savings-tracker.ts`, `member-schedule.ts`, `tier-config.ts` portal half) — the redesign must sever these or inherit wrong numbers | §2 correctness |
| R4 | Founder decision: is Home Care Score a customer-facing concept, and in what frame? | §6 scope |
| R5 | Confirm timeline data source of record (appointments as spine?) and what real data exists at launch | §7 architecture |
| R6 | Recommendations source at launch: founder-authored table, manual field, or omit entirely? | §8 scope |
| R7 | Portal token mechanics from 001-P5 (query param vs path segment) — affects every portal route Jerry builds | Everything |
| R8 | Which existing portal components survive (wallet card, health panel, savings tracker) vs. get rebuilt — inventory `components/membership/` + `components/portal/` against this plan before writing anything new | Effort estimate |

---

## Part 4 — Verification (the deck's tests, adapted)

Run on every section, at 375px first:

1. **5–8 second test:** hand the phone to someone who's never seen it. They must answer "what is this / what's my status / what happens next" inside 8 seconds — for the *empty* portal, since that's launch reality.
2. **Squint test:** one headline dominant per screen; gold used only for status/CTA (if everything glows, nothing does).
3. **No-narration test:** every number has its unit and context inline (`$250 · per visit`, never bare `250`).
4. **Continuity test (new, portal-specific):** put the close slide and the portal landing side by side — same fonts, same stage, same ✓-vocabulary, same billing sentences. A customer flipping between the emailed deck and the portal should not sense a seam.
5. **Honesty test:** grep the rendered portal for every string in the Part 2 blacklist; then load a zero-data member and confirm no invented history and no zero-counters.
6. **Reduced-motion + keyboard:** parity with the deck's standard (focus-visible rings, aria-current, `useReducedMotion` collapse).

## Part 5 — Execution order for Jerry

```
0. RECON R1–R8 written up            (no code)
1. Kill fabricated schedule paths     (small, unblocks honesty everywhere)
2. Empty-state portal, mobile-first   (§9 — the launch product)
3. Landing + Membership + Agreement + Payment  (§1,2,4,5 — full on day one)
4. Next visit + Property Memory       (§3,6)
5. Timeline + Photos shells           (§7,8 — real data arrives with first visits)
6. Continuity + honesty verification  (Part 4)
```

**Abort condition:** if at any step the portal requires showing data the blacklist forbids to look "complete," stop and cut the section instead. A smaller honest portal continues the presentation; a fuller dishonest one ends it.
