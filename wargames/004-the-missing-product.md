# WARGAME 004 — The Missing Product

**Status:** Permanent planning document. No code changes. No implementation. Product discovery only.
**Question answered:** *If HomeAtlas became wildly successful tomorrow, what obvious parts of the product would still be missing?*
**Assumptions:** launch succeeds · 10,000 homeowners · SqueegeeKing runs entirely on HomeAtlas · the Standard holds.

**Volume convention — CORRECTED after reading THE_HOMEATLAS_STANDARD.md.** The RECON flag in the original draft is resolved: the Standard's real structure is **I Philosophy · II Company · III Product · IV Engineering & Architecture · V Design · VI Business · VII The Future.** The "Volume V/VI/VII" tags in the body of this document were written before the Standard was available and denote **delivery eras**, not Standard volumes. Read them as:

| Tag in this document | Means | Roadmap anchor |
|--------|-----|----------------|
| ~~Volume V~~ → **Era 1** | Operator completeness — one company runs whole on the OS | V1.1, 2026–27 |
| ~~Volume VI~~ → **Era 2** | Field & intelligence — the visit loop closes | V2, 2027–29 |
| ~~Volume VII~~ → **Era 3** | Platform & ecosystem — tenants, homeowner network | Future, 2028–31 |
| ~~Volume VIII~~ → **Era 4** | Category & legacy — decades of memory | 2031+ |

Where each finding belongs **in the Standard itself** is given in the *Reconciliation with the Standard* section at the end of this document.

Priority scale: **Now** (before/at first cohort) · **Soon** (first 500 homes) · **Later** (5,000 homes) · **Someday** (50,000 homes / platform era).

---

## 1. Founder Experience — what Noah will wish existed

### 1.1 The Obligation Ledger (visits promised vs. visits delivered)
A membership is a **sold future**: Quarterly = 4 promised visits/year. HomeAtlas meticulously tracks the money side (ARR, collected, performance) and tracks *nothing* on the liability side. At 500 members that's ~1,500 outstanding visit-obligations per year and no screen answers: *how many visits do we owe, to whom, by when, and are we falling behind?*
- **Why it matters:** this is the integrity metric of the entire business model. ARR without fulfillment tracking is how service companies quietly become subscription scams without ever intending to.
- **When:** the day member #50 signs. — **Now.** — **Volume V.**
- **Solves:** overselling capacity invisibly; the accountant's deferred-revenue question; the founder's 2am "are we keeping our promises?" question.

### 1.2 The Revenue Calendar (forward view)
Billing on the 1st of the service month means future revenue is *derivable from the schedule* — yet HQ only looks backward. Noah cannot see "August will bill $14,300 across 61 members."
- **When:** first 100 members. — **Soon.** — **Volume V.**

### 1.3 Delegation without exposure
HQ is built for two founders who see everything. Employee #1 in the office needs requests, scheduling, and customer context — and must *not* see lifetime revenue, the founder journal, or the freedom meter. There is no role model at all (one PIN, all or nothing).
- **When:** first non-founder hire. — **Soon.** — **Volume V.**

### 1.4 The Pricing Exception Log
The engine is law, but `visitPrice` overrides exist (correctly — Noah tweaks in the field). What's missing is the *memory of why*: who overrode, from what engine price, for what reason. Without it, discount drift silently repeals the pricing law one handshake at a time, and in year 3 nobody knows why the Hendersons pay $185.
- **When:** ~100 members. — **Soon.** — **Volume V.**

### 1.5 Continuity ("systems that outlast us," literally)
The company constitution says systems should outlast the founders. Test it: if Noah is unreachable for a month, what does Dasan actually have? No credential vault, no operational runbook surface in HQ, no documented ownership of the Stripe/Supabase/Google accounts. The OS should hold its own succession plan.
- **When:** before it's needed, which is unknowable. — **Soon.** — **Volume V.**

---

## 2. Homeowner Experience — missing moments of trust

### 2.1 The Arrival Moment
A stranger is about to walk around your home. The world's best version: the night before — *"Marcus is coming tomorrow between 9–11. He's cared for your home 3 times."* With a photo. Day-of: *"Marcus is on his way."* Nothing in the product knows who is coming or tells the homeowner.
- **When:** the first visit performed by anyone who isn't Noah or Dasan. — **Soon.** — **Volume VI.**

### 2.2 The Visit Receipt (same day, not a receipt)
Within hours of a visit: what was done (✓-vocabulary from the deck), 2–3 photos, one human sentence. This is planned as "AI Engine" output — but it's mis-filed as an AI feature. It's a **trust feature** that should ship manual-first (technician taps, founder approves) long before AI writes it.
- **When:** first cohort of real visits. — **Now** (manual), AI later. — **Volume V** manual / **VI** automated.

### 2.3 The Guarantee Button
"7-Day Workmanship Guarantee" appears in the deck, the tiers, the agreement. It has no mechanism. A guarantee without a claim path is marketing; with one button — *"Something not perfect? We'll return."* — it becomes the single strongest trust artifact in the portal. Bonus: the proactive version, 3 days post-visit: *"Still perfect? One tap if not."*
- **When:** first cohort. — **Now.** — **Volume V.**

### 2.4 The Household, not the homeowner
One `homeowner` = one person. Real luxury homes have two decision-makers, a house manager, sometimes an assistant. The spouse who didn't sign gets: no portal, no emails, no arrival notices — for *their own home*. Also unmodeled: the property manager who manages 12 client properties (a whale customer shape the current model cannot represent).
- **When:** immediately visible; painful by 500 homes. — **Soon.** — **Volume V** (spouse), **VII** (manager-of-many).

### 2.5 The Move — the property outlives the relationship
Property-first is the constitution, yet the product has no concept of **ownership succession**. When a member sells their home: Does the archive transfer? Does the new owner inherit the care record (a home's service Carfax — an *asset* at sale time: "professionally maintained, documented, here's ten years of proof")? Does the seller carry their membership to the new house? Every answer is a product; none exist. This is simultaneously a churn-rescue flow (movers = cancellations today) and the deepest expression of "documenting the life of a property."
- **When:** first member who moves — roughly year 1 at 10% annual mobility. — **Later** (flow), **Now** (data model must anchor eras of ownership so the future is possible). — **Volume VII**, foundations in **V**.

---

## 3. Technician Experience — tools that don't exist

The Technician App is a known gap (not started). The unknown unknowns are *inside* it:

### 3.1 The Property Briefing (before the doorbell)
Not just the address — the memory: gate code (audited access, auto-expiring), the dog's name, "baby naps 1–3, don't ring," "transom over garage needs the 24-ft pole," "sprinklers hit the west windows — hard-water watch." Today `access_instructions` and `service_notes` exist as raw columns; the *briefing* — curated, per-visit, security-classified — does not. The dog's name is a luxury detail; the pole note saves a return trip.
- **When:** first tech who isn't a founder. — **Soon.** — **Volume VI.**

### 3.2 The Craft, encoded (SOP per service)
When technician #3 is hired, "the SqueegeeKing way" lives in Noah's head. The OS should carry versioned service checklists — what a Quarterly exterior visit *includes*, in order, with photo checkpoints. This is also the multi-tenant product later: HomeAtlas doesn't just present care beautifully, it *standardizes* it.
- **When:** hire #2–3. — **Later.** — **Volume VI**, becomes platform asset in **VII**.

### 3.3 Technician memory & recognition
Which homes has Marcus cared for? Redo rate, photo quality, member praise routed back to him. The tech's own "story so far." Field workers stay where their craft is *seen* — retention of good technicians is the real capacity constraint at 5,000 homes.
- **When:** 3+ techs. — **Later.** — **Volume VI.**

---

## 4. Company Operations — pain at 500 / 5,000 / 50,000

| Scale | What breaks | Missing product | Priority / Volume |
|-------|-------------|-----------------|-------------------|
| **500** | Calendar chaos | Capacity model: members × frequency vs. crew-days; service-area zones; the **waitlist** (membership sales must throttle against fulfillment capacity — see 1.1) | **Soon** / **V** |
| **500** | Rain | **Weather reflow**: one rainy week displaces dozens of visits; rescheduling must cascade without breaking "billed on 1st of service month" (reschedule across a month boundary is a billing question nobody has answered) | **Soon** / **V–VI** |
| **5,000** | Routes | Drive-time is the profit killer; route density metrics and neighborhood clustering (which also powers the referral motion — "we're already on your street Tuesday") | **Later** / **VI** |
| **5,000** | Card declines | **Dunning**: at 2% decline rate, ~100 failed billings/month; retry logic, grace period, and *kind* communications ("locked member pricing" + suspended-discount rules already promise consequences the product can't execute) | **Later**, design **Soon** / **VI** |
| **5,000** | Seasons | Demand shaping: everyone wants April–June; membership cadence must spread load or the model collapses into a spring bottleneck. Pricing engine knows sqft, not seasonality | **Later** / **VI** |
| **50,000** | Everything legal | Compliance registry: licenses, bonds, insurance certs per tenant; sales-tax across jurisdictions; the homeowner-facing version — "Send my HOA your certificate of insurance" is a real button real customers ask for | **Someday** / **VII** |
| **50,000** | HomeAtlas itself | **The platform's own business model is undefined**: how tenant #2 pays, what's metered, and — the hard one — *who owns the data when a tenant leaves*. The tenant-divorce terms must be written before tenant #2 signs, not during the divorce | **Later** (define), **Someday** (build) / **VII** |

Also at every scale: **the billing engine does not exist.** Cards are stored; nothing charges them. Recurring charge runs, receipts (legally required), refunds, proration — an entire subsystem everyone assumes "Stripe does." Stripe holds the card; HomeAtlas must decide to charge it. — **Now** (design), **Soon** (build). — **Volume V.** *(See §13.1.)*

---

## 5. Property Intelligence — what HomeAtlas should remember forever

The Apollo Directive already lists the destination (window count, sun exposure, water quality…). The unknown unknowns are the *record types* nobody has named:

| Memory | Why forever | Priority / Volume |
|--------|-------------|-------------------|
| **Treatment log with efficacy windows** | RainBlock applied 3/2027 → protection decays → re-application due. Treatment half-life *is* scheduling intelligence and honest upsell ("your sealant is aging out" beats "wanna buy sealant?") | **Soon** / **VI** |
| **Window & screen inventory** | Count, types, specialty glass, which screen was rescreened when. Turns quotes exact, catches damage disputes, makes visit #40 as informed as a blueprint | **Later** / **VI** |
| **The evidence chain** | Recommendation → decision (accepted/declined) → outcome photos. Respectfully: "we noted this in March; here's September." Declined recommendations are memory too — that's what "the software remembers your home better than you do" actually means | **Later** / **VI** |
| **Incident file** | Damage, breakage, complaint, resolution — per property, permanent. The uncomfortable memory is the trust-critical memory | **Soon** / **V** |
| **Ownership eras** | Same house, successive owners; archive continuity across the sale (§2.5) | Model **Now**, product **Later** / **VII** |
| **Weather history correlation** | Hail on 6/12 → check-in + photo comparison. The home exists in weather; the record should too | **Later** / **VI** |

---

## 6. Membership Experience — Year 2 and beyond

### 6.1 The Anniversary
Evergreen billing means Year 2 starts as… nothing. A charge. The world's best version: the **Year of Care** — a quiet annual artifact (the roadmap's Annual Home Care Review) plus a *membership moment*: "Member since 2026" is cheap to store and priceless at year five. Founding-member status for the first cohort costs nothing today and can never be granted retroactively later. **Record it now.**
- **Now** (the flag), **Later** (the artifact). — **Volume V / VI.**

### 6.2 "Locked member pricing" is an unpriced promise
The deck promises locked pricing. Locked for how long? Against what inflation? There is no policy, no grandfathering model, no increase-communication framework. In year 3 this becomes either a margin crisis (never raise) or a trust crisis (raise badly). The policy must be written while it's still hypothetical.
- **Now** (policy decision), **Later** (tooling). — **Volume V.**

### 6.3 The ends and edges of membership
No cancel, pause (snowbirds/Lake Almanor summers), downgrade, transfer, or bereavement path exists (`cancelled_at` is a column, not a product). Luxury brands are *defined* by their exits. And there's a legal floor: auto-renewing subscriptions face click-to-cancel and renewal-notice laws (California ARL among them) — cancellation UX is compliance, not courtesy.
- **Now** (minimum lawful cancel path), **Soon** (pause/transfer). — **Volume V.** *(See §13.3.)*

### 6.4 The portfolio household
Larry Buckley has four properties — the demo *is* the use case — yet membership is strictly per-property with no household view, no portfolio pricing, no single relationship across properties.
- **Later.** — **Volume VI.**

### 6.5 Gifting & the realtor channel
A membership is a perfect closing gift ("the home comes with a year of care — documented"). Realtors buying trust-at-scale is the organic growth channel that fits the brand; discount codes are the one that doesn't.
- **Someday.** — **Volume VII.**

---

## 7. Communication — conversations HomeAtlas should create

Today the product sends exactly one email (the signed agreement). The missing conversation engine, in the order it will hurt:

| Conversation | Trigger | Priority / Volume |
|--------------|---------|-------------------|
| Visit scheduled / reminder / en-route / complete | Scheduling events | **Now–Soon** / **V** |
| Billing receipt | Every charge (legal) | **Now** with billing engine / **V** |
| Weather reschedule | Reflow (§4) | **Soon** / **V–VI** |
| The confidence check | 3 days post-visit: "Still perfect?" (§2.3) | **Soon** / **V** |
| Failed payment, kindly | Dunning, graduated tone | **Soon** / **VI** |
| **The storm check-in** | Severe weather at their address: "Last night's hail — want us to look?" — the purest "we're watching over your home" moment in the whole product, and it's just Atlas + a weather API | **Later** / **VI** |
| Seasonal notes | "Your April visit is timed after pollen peak — on purpose" (shows the *thinking*, which is the product) | **Later** / **VI** |
| Anniversary / Year of Care | §6.1 | **Later** / **VI** |

Two structural pieces beneath all of them:
- **The Conversation Record:** communication *is* property memory. Every message (and the homeowner's replies — "can we move Thursday?" currently lands in a personal phone's black hole) belongs on the property's record. — **Soon.** — **Volume V.**
- **The Comms Constitution:** channel preferences, quiet hours, frequency caps, and a tone standard for automated messages (the copy style guide covers UI; nothing governs what the *robot* says at 7am). One bad automated text undoes ten perfect visits. — **Soon.** — **Volume V.**

---

## 8. Scheduling — what is obviously incomplete

**CORRECTED after reading the Standard.** The original draft prescribed building a scheduling engine. The Standard rules otherwise: **Guideline 005 (Integrate Before You Replace)** and the Jobber v0.1 case study (§3.8) make Jobber the scheduling source of truth, with HomeAtlas as the read-and-summarize intelligence layer. "Do not build scheduling yet" is written policy. The finding is therefore reframed — what's *actually* missing:

1. **The Jobber integration itself** — the `external_jobs` table and sync specified in Standard §3.8 exist nowhere in the codebase. The Standard's v0.1 scheduling answer is specified but unbuilt: Last Visit / Next Visit in the portal, HQ schedule display, "completed job missing health check" flags. This is the real Now-item.
2. **The obligation ledger still stands** (§1.1) — Jobber holds *events*, not *promises*. Visits-owed-vs-delivered is membership truth, which the Standard assigns to Estimates & Agreements (3.4.8) territory, not Jobber. No integration provides it.
3. **Skip/credit accounting still stands** — when a Jobber job is cancelled, the membership obligation doesn't vanish with it; reconciling external events against promised visits is HomeAtlas's job precisely *because* Jobber doesn't know what a membership is.
4. **The billing coupling still stands** — "billed on the 1st of the service month" (Volume VI, Membership Billing) welds billing to a schedule HomeAtlas doesn't own. A reschedule in Jobber across a month boundary is a billing event HomeAtlas must detect via sync. This interaction is specified nowhere.
5. **Weather as input** (§4) — applies to whoever owns scheduling; in v0.1 that's operational practice in Jobber, but the storm check-in (§7) is HomeAtlas-side regardless.
6. **Replacement is earned, not assumed** — native scheduling (windows-not-timestamps, bounded self-service, recurrence generation) is the *eventual* product, gated by Guideline 005's test: only after HomeAtlas can demonstrably do it better and simpler.
- **Now** (Jobber sync per §3.8 + obligation ledger), **Later** (earn native scheduling). — Standard homes: **III §3.8 / VI**.

---

## 9. AI — where Atlas quietly helps without replacing people

The concierge doc's philosophy is right (grounded, calm, invisible when empty). The unclaimed territory:

| Quiet help | What it is | Priority / Volume |
|------------|-----------|-------------------|
| Visit documentation (planned) | Tech bullets → prose, summary, score explanation — founder-approved | **Soon** / **VI** |
| **Photo conscience** | "Only 2 photos this visit; the west side wasn't documented" — Atlas as the guardian of the archive's completeness, because the archive is the moat and undocumented visits are holes in it | **Later** / **VI** |
| **Deterioration watch** | Same angle, 8 visits, 2 years → "mineral spotting progressing on west windows" (this is literally the Apollo Directive's future-vision quote — someone must schedule it) | **Later** / **VI** |
| Pricing conscience | "This quote is 38% under engine price — confirm?" — Atlas guards the pricing law without vetoing the founder | **Soon** / **V** |
| Churn whisper | Declined reschedules + unopened messages + guarantee claim = a card in the Morning Brief, weeks early, human follow-up | **Later** / **VI** |
| Reflow proposer | After a rained-out Tuesday: a proposed reshuffle to approve, not an auto-sent apology blast | **Later** / **VI** |

Constitution holds: no customer-facing chatbot, no autonomous outbound, founder approval on anything a homeowner reads.

---

## 10. Reporting — what becomes essential

Revenue reporting is genuinely strong already. Missing, in order of arrival:

1. **The Promise Report** — visits owed vs. delivered, on-time %, redo rate, response time. The Standard, as numbers. If HQ shows one new report, it's this. — **Now.** — **V.**
2. **Accountant's exports** — month-one reality: revenue/deferred revenue export, tax categories, QuickBooks-shaped CSVs, 1099 data for subs. Unglamorous; unavoidable. — **Soon.** — **V.**
3. **Cohort retention curves** — month-12 retention by signup cohort is the number that decides whether this business model works. — **Soon.** — **V.**
4. **Capacity & route density** — crew-days vs. obligations; drive-time per visit trend. — **Later.** — **VI.**
5. **Reputation flywheel** — review velocity vs. visit volume (are visits generating advocacy?). — **Later.** — **VI.**
6. **Tenant health** (platform era) — per-tenant Promise Report; HomeAtlas holding its tenants to the Standard is the *product*. — **Someday.** — **VII.**

---

## 11. Trust — what the world's best would do that HomeAtlas doesn't yet

1. **Named, photographed, background-checked arrival** (§2.1) — strangers-at-the-home is the industry's original sin; solving it visibly is the flag.
2. **Self-reported imperfection** — "We missed the garage transom; returning Tuesday, no charge." Confession before discovery is the single most expensive-feeling behavior in service. Needs the incident/redo object (§5) to exist.
3. **The guarantee with a button** (§2.3).
4. **Photo dignity** — a stated, homeowner-visible policy: interior/exterior photos never used in marketing or sales presentations without explicit consent; retention rules; export/delete on request. *Unknown unknown inside it:* the before/after gallery culture of this industry is a consent time-bomb, and the archive of a luxury home's access points is a security-sensitive asset, not just storage. — **Now** (policy), **Soon** (consent flags in data). — **V.**
5. **Your record is yours** — one-tap export of the full property archive. Portability *creates* retention: "I don't want to lose this" only lands if leaving is visibly possible.
6. **Insurance on display** — bonded/insured status and the HOA-certificate button (§4).

---

## 12. Luxury — where the experience stops feeling premium

The purchased path is now genuinely premium (deck → signing → ceremony). The seams are all *after* and *around*:

- **The silence after the signature** — between ceremony and first visit lives an empty week where the brand goes mute. A welcome sequence and "what happens next" is the cheapest luxury in the whole plan. — **Now.** — **V.**
- **When money goes wrong** — a failed charge is where luxury brands are made; graduated, generous, human dunning (§4) vs. instant discount-suspension threats (which current agreement copy promises!). Reconcile the copy with the intended behavior. — **Soon.** — **V.**
- **The exit** — cancellation handled beautifully ("your home's records remain yours — export here; we'd be honored to resume anytime") converts churn into future referrals. Today the exit doesn't exist at all (§6.3), which is the least premium experience possible. — **Now.** — **V.**
- **The reply void** — a member texts back and nothing in the system knows (§7). Premium is *response*, not aesthetics.
- **The physical layer** — trucks, uniforms, leave-behind cards: the OS can't clean a truck, but a brand-kit standard belongs in the multi-tenant Standard (a tenant with beautiful software and a rusted ladder rack breaks the promise HomeAtlas made on their behalf). — **Someday.** — **VII.**

---

## 13. Unknown Unknowns — what you'd be embarrassed you never built

The five discoveries of this wargame that no existing doc, roadmap line, or prior wargame names:

### 13.1 There is no billing engine.
Cards on file ≠ billing. Nothing charges cards, issues receipts, retries declines, handles refunds, or prorates changes. Everyone in the building assumes "Stripe does that." Stripe *holds the card*; deciding when and what to charge — and what happens when it fails — is a product HomeAtlas hasn't started. The first "1st of the month" with real members is the deadline nobody has on a calendar. — **Now. Volume V.**

### 13.2 The company sells futures and doesn't track them.
The Obligation Ledger (§1.1) restated as the epitaph to avoid: *"They knew their revenue to the dollar and their promises not at all."* Deferred obligations are both the accounting reality and the moral ledger of a membership business. — **Now. Volume V.**

### 13.3 Nothing has an ending.
No cancellation, no pause, no transfer, no death-of-member path, no tenant-offboarding terms, no data-retention policy, no photo deletion, no ownership-change flow. The entire product is built for beginnings. Endings are where law lives (auto-renewal statutes), where trust is proven (§12), and where the property-first philosophy gets tested (§2.5). A stewardship company that hasn't designed its endings hasn't finished designing stewardship. — **Now** (policy + lawful cancel), rolling thereafter. **Volume V–VII.**

### 13.4 The archive is a liability as well as a moat.
Ten years of interior photos, gate codes, alarm notes, and "back door lock sticks" annotations for 10,000 affluent homes is — viewed coldly — a burglary-intelligence database. The moat and the breach-headline are the same asset. Missing: security classification of property data (secrets vs. memories), consent framework (§11.4), retention policy, and the storage economics of forever (800k photos/year at 10k homes; who pays for decade-old archives is a *pricing-model* question, not an infra question). — **Policy Now, product Soon–Later. Volumes V–VII.**

### 13.5 Weather is a core entity of this business and appears nowhere.
Rain cancels work, storms create the finest care moments (§7), treatments decay by exposure (§5), seasons shape demand (§4), and RainBlock — a flagship differentiator — is literally a weather product. There is no weather anything in the system. The company's calendar, promises, and pitch are all weather-coupled; the OS is weather-blind. — **Soon. Volume VI.**

Plus three smaller embarrassments, cheap now and impossible later: **founding-member status not being recorded** (§6.1); **"locked pricing" having no written meaning** (§6.2); **replies from members going to a personal phone with no record** (§7).

---

# The Three Closing Sections

## I. The next 25 features HomeAtlas should eventually have

| # | Feature | Priority | Volume |
|---|---------|----------|--------|
| 1 | Billing engine (charge runs, receipts, refunds) | Now | V |
| 2 | Obligation Ledger + Promise Report | Now | V |
| 3 | Lawful, beautiful cancellation & pause | Now | V |
| 4 | Guarantee claim button + confidence check | Now | V |
| 5 | Welcome sequence (signature → first visit) | Now | V |
| 6 | Founding-member flag & member-since | Now | V |
| 7 | Locked-pricing policy + exception log | Now | V |
| 8 | Photo consent & data-classification policy | Now | V |
| 9 | Visit lifecycle comms (scheduled/reminder/en-route/receipt) | Soon | V |
| 10 | Scheduling engine (recurrence, windows, skip-credits, billing coupling) | Soon | V |
| 11 | Conversation record per property (incl. inbound) | Soon | V |
| 12 | Revenue calendar (forward billing view) | Soon | V |
| 13 | Roles — delegation without exposure | Soon | V |
| 14 | Household model (spouse today, manager-of-many later) | Soon | V/VII |
| 15 | Incident & redo file | Soon | V |
| 16 | Accountant exports | Soon | V |
| 17 | Capacity model + membership waitlist | Soon | V |
| 18 | Dunning with grace (design now, need later) | Soon/Later | VI |
| 19 | Weather layer (reflow, storm check-in, treatment decay) | Later | VI |
| 20 | Technician briefing + encoded SOPs + tech memory | Later | VI |
| 21 | Treatment log & window inventory | Later | VI |
| 22 | Evidence chain (recommendation → decision → outcome) | Later | VI |
| 23 | Cohort retention & route density reporting | Later | VI |
| 24 | Ownership succession / property passport | Later | VII |
| 25 | Tenant terms: platform pricing, data ownership, offboarding, brand kit | Later/Someday | VII |

## II. The five most important things HomeAtlas is still missing

1. **The billing engine** — the product literally cannot collect the recurring revenue it sells. (13.1)
2. **The Obligation Ledger** — the promise side of the ledger; without it, growth is indistinguishable from overselling. (13.2)
3. **Scheduling as a real engine** — the largest empty room; everything from §1–§9 routes through it.
4. **Endings** — cancellation, pause, transfer, succession, retention policy; the missing half of stewardship. (13.3)
5. **The communication layer** — the OS is mute after the agreement email; every trust moment in §2, §7, §11 rides on it.

## III. What people will someday assume "was always there"

If HomeAtlas succeeds beyond expectation, homeowners, operators, and buyers in 2036 will take for granted:

- That **every home has a care record the way every car has a Carfax** — and that the record transfers at sale, raises the home's value, and started accruing the day the first technician arrived. Nobody will believe there was a time HomeAtlas didn't do this. It does not exist today.
- That **the person arriving was introduced before the doorbell rang** — name, face, history with the home.
- That **the storm check-in text** the morning after hail was always part of having "people who watch over the house."
- That **"Member since 2026 · Founding Member"** on a wallet card was recorded from day one. (It is not being recorded. Start today — this one is unrecoverable.)
- That the company **always knew exactly what it owed every home** — and that the Promise Report was the first screen every operator saw, before revenue.
- That **declining a recommendation was remembered respectfully** and revisited with photographs, not repeated as a pitch.
- That **leaving was graceful and the archive came with you** — and that this was precisely why so few left.

---

# Reconciliation with THE_HOMEATLAS_STANDARD

*Added after reading the full Standard (all seven Volumes) and STANDARD_PROCESS_NOTES.md. The Standard lives outside this repo (founder's session outputs). Three kinds of result below: corrections to this document, convergences where the wargame independently reached the Standard's own open questions, and Standard homes for each major finding.*

## Corrections applied

1. **Volume convention** — fixed in the header. The Standard's Volumes are Philosophy / Company / Product / Engineering / Design / Business / Future; this document's inline tags are delivery **Eras**.
2. **§8 Scheduling** — rewritten. Guideline 005 + §3.8 make Jobber the v0.1 scheduling truth; the missing product is the specified-but-unbuilt `external_jobs` sync and the membership-side obligation accounting Jobber cannot hold, not a native engine.

## Convergences — wargame findings that answer the Standard's own open questions

| Standard open question (location) | This document's answer |
|---|---|
| "How should homeowners transfer history when selling?" / "Should new owners inherit Property Memory?" / "Can homes have permanent identity independent of the owner?" (3.4.2, 3.4.4) | §2.5 + §13 — ownership eras in the data model now; property passport / care-record-as-asset later. The wargame's strongest recommendation is that the Standard promote this from open question to committed principle: **the home outlives every relationship** is already Volume IV's own maxim (4.4, "The Home Is the Center"). |
| "How should a change in home ownership affect an active agreement?" (3.4.8) | §2.5, §13.3 — design the ending; transfer or graceful close, never silent lapse. |
| "Pausing and cancelling are as respectful as signing" (3.4.8 — stated as product rule, product doesn't exist) | §6.3, §12 — the wargame adds the legal floor (auto-renewal / click-to-cancel statutes) and the timeline: lawful cancel path is a **Now** item, not an eventual courtesy. |
| "Should Health Checks become required for memberships?" (3.4.6) | §1.1 / §10 — yes, indirectly: Law 003 ("a visit that leaves no memory is incomplete") plus the Promise Report makes memory-per-visit measurable; §3.8's "completed job missing health check" flag is the enforcement surface. |

## Conflicts checked — none found

Every §13 unknown-unknown was re-tested against the twelve Product Laws: the billing engine serves Law 008 and Volume VI's billing principle (which is *stated* but has no machinery); the obligation ledger is Law 003 turned into arithmetic; endings/photo-consent extend Law 004's spirit ("never punish the customer") to money and privacy; the weather layer is Law 001 fuel (reality before intelligence). Nothing proposed requires bending a Law.

## Standard homes for the major findings

| Finding | Belongs in |
|---|---|
| Billing engine, dunning, revenue calendar, locked-pricing policy, obligation ledger | **Volume VI (Business)** — Membership Operations, alongside the existing Membership Billing principle; surface ownership in **III 3.4.8** |
| Endings (cancel/pause/transfer/succession) | **III 3.4.8** (owns the states already) + **Volume VI** policy + **Volume VII** (ownership succession horizon) |
| Guarantee button, visit receipt, arrival moment, comms engine, storm check-in | **III 3.4.2 / 3.4.9** (surfaces) with the comms constitution as a new **Volume VI** section |
| Photo consent, data classification, archive-as-liability | New section — recommend **Volume VI (Business: privacy & data policy)** with a Law-level candidate: *"Memory is held in trust"* — deserves the five-step promotion process from STANDARD_PROCESS_NOTES.md |
| Technician briefing, SOP encoding, tech memory | **III 3.4.6** (extends the existing surface) |
| Treatment log, evidence chain, window inventory, weather | **III 3.4.4 Property Memory** ("what belongs" list grows) |
| Founding-member flag, anniversary, portfolio household | **III 3.4.8 + Volume VI** |
| Platform business model, tenant divorce terms, brand kit | **Volume VI** (licensing) + **Volume VII** |
| Delegation/roles, continuity vault | **III 3.4.1 Headquarters** (open question already lists role-based modules) + **Volume II** (The Company) |

## One process note

Per STANDARD_PROCESS_NOTES.md, principles enter the Standard only after the five-step promotion (build → notice → name → test → promote). This document deliberately supplies step-zero *candidates*, not Standard text. The two strongest candidates to begin the promotion path: **"Every promise is a ledger entry"** (from §13.2) and **"Memory is held in trust"** (from §13.4).

---

*Filed as wargames/004. If founders ratify the priorities, promote the closing sections into `docs/ROADMAP.md`. The Standard itself remains the authority; this document feeds it through the promotion process, never around it.*
