# WARGAME 007 — The Missing Operating System

*Assume HomeAtlas launches tomorrow with 100 real members. I am the unforgiving operating partner. I am not here for features. I am here for the places the company breaks in the first twelve months — operationally, legally, financially, emotionally, philosophically.*

**Discipline of this document:** every finding is new (cross-checked against wargames 001–006 and the clarifications doc; overlaps are named and excluded). Every finding cites evidence already in the HomeAtlas corpus — code, Standard, or agreement copy. Nothing here is a feature request; each "smallest change" is a decision, an owner, a definition, a document, or a manual step. If I could not point to evidence, I left it out.

**The through-line:** HomeAtlas has built the systems that *acquire a member* and *remember a home*. It has assumed the systems that *fulfill the promise* and *move the money*. The missing operating system is the entire layer between **"member signs"** and **"member is provably cared for and correctly billed."** Everything below is a hole in that layer.

---

## Ranked by expected damage (damage × likelihood over 12 months)

| # | Finding | Class | First appears | Severity |
|---|---------|-------|---------------|----------|
| 1 | Sign→schedule handoff has no owner | Operations | Week 1 | Critical / near-certain |
| 2 | Recurring-payment agreement is unreviewed contract law | Legal | Latent at launch | Critical / tail-catastrophic |
| 3 | Membership benefits are unfunded, undefined, partly undeliverable promises | Product + Standard | Month 1–2 | High / certain |
| 4 | Flagship Quarterly tier's "complimentary every visit" is untracked COGS | Business | Silent from day 1 | High / certain-but-invisible |
| 5 | Chargeback defense requires evidence three systems don't share | Financial + Legal | Month 2–3 | High / moderate, existential tail |
| 6 | Payment status and dispatch never reconcile (the arrears truck) | Operations + Financial | Month 2 | Medium-High / likely |
| 7 | The add-on discount suspension clause cannot be honored | Legal + Trust | Month 2–3 | Medium / likely |
| 8 | Cash flow is lumpy by design, with no cash-position visibility | Business | Month 2–4 | Medium / likely |
| 9 | No mechanism transmits the Standard to the first hire | Philosophical + Ops | Month 3–6 | Medium now / existential slow-fuse |

---

## 1 — The sign→schedule handoff has no owner

**Why it matters:** This is the single moment the whole brand is bet on: a member signs, pays, and waits to be cared for. The signing flow writes homeowner + property + membership to Supabase and flips status toward active. Then *nothing happens*, because scheduling lives in a different system (Jobber, per Standard §3.8) that HomeAtlas only *reads*, and no process, owner, or SLA turns "signed in HomeAtlas" into "booked in Jobber." At 100 members onboarding over weeks, members will sign and fall into the gap between the two systems. The failure mode is not a missing welcome email — wargame 004 §12 already covered the *silence*. It is worse: the first visit may never be scheduled at all, because responsibility for scheduling it belongs to no one.

**When it first appears:** The first member who signs and isn't manually booked — week 1.

**Severity:** Critical. It converts the company's proudest moment (the unlock ceremony, "your home is now under our care") into "I signed up three weeks ago and no one came." That member charges back (see #5), tells the neighbor who referred them, and the referral engine runs in reverse.

**Evidence:** `complete-sign-onboarding.ts` writes the member record and sets `pending_payment`/`active`; Standard §3.8 makes Jobber the scheduling source of truth and states it is *not built*; there is no scheduling surface in HomeAtlas and no sign→Jobber bridge anywhere in the corpus.

**Smallest change that prevents it:** Name one person as the handoff owner and write a one-line SLA: *every signed membership is booked in Jobber within N business days, tracked on a shared list.* A spreadsheet with two columns (signed date, booked date) is enough to make the gap visible until the systems connect. This is an ownership decision, not a build.

**Belongs in:** Operations (with a supporting rule in the Standard: no membership is "active" in spirit until its first visit is on a calendar).

---

## 2 — The recurring-payment agreement is unreviewed contract law

**Why it matters:** The moment the company stores a card and bills it on a recurring schedule, the signed agreement stops being a nice PDF and becomes a consumer finance contract governed by state law. The agreement copy is founder-authored prose in the repo, not lawyer-reviewed contract language. Chico is in California, whose Automatic Renewal Law requires clear pre-purchase disclosure of auto-renewal terms, affirmative consent, an accessible cancellation path, and renewal reminders. The agreement states no term, no renewal mechanics, no cancellation terms, and promises "locked member pricing" with no defined meaning. At 100 members you hold 100 recurring contracts of unknown enforceability, and the "locked pricing" line may have quietly written the company into never being able to raise prices.

**When it first appears:** Latent from the first signature. It surfaces the day a member disputes a renewal, a cancellation turns hostile, or a regulator asks — any of which can happen in month one and none of which you control.

**Severity:** Critical tail. Low probability in twelve months, but the downside is voided contracts, statutory penalties, and refunds across the entire member base at once. This is the one finding that can retroactively invalidate everything else the company did right.

**Evidence:** `agreement-content.ts` is prose written in the repository with no legal-review artifact; `ADDON_DISCOUNT_FINE_PRINT` and the "Locked member pricing" benefit in `tier-config.ts` are commitments; billing "on the 1st of the service month" with no stated term = auto-renewal; the business operates in California. Wargame 004 flagged cancellation UX and locked-pricing *policy* as gaps — it did not flag that the contract itself is legally unvetted. That is the new part.

**Smallest change that prevents it:** One legal review of the agreement template and the tier fine print by a California consumer-contracts attorney, before member 101. Not a feature — an errand, and the cheapest insurance the company will ever buy.

**Belongs in:** Legal / Business (the reviewed template then becomes the source of truth referenced by 3.4.8).

---

## 3 — Membership benefits are unfunded, undefined, partly undeliverable promises

**Why it matters:** The signed agreement lists benefits as if they were features already built: "VIP Priority Scheduling," "Property Health Monitoring," "Automatic service reminders," "7-Day Workmanship Guarantee." Each is a contractual promise. None has an operational definition, an owner, or a delivery mechanism, and at least one cannot be delivered in year one *by the company's own doctrine*: "Property Health Monitoring" requires health-check data across visits, and Law 011 forbids manufacturing intelligence before the evidence exists. So the company has sold, in writing, a service it has correctly promised itself not to fake. At 100 members, every benefit gets invoked, improvised, and delivered inconsistently — which is a direct violation of the consistency doctrine the entire Standard is built on (Volume I Ch. 5), and edges toward selling benefits that don't exist.

**When it first appears:** Month 1–2, the first time a member invokes "priority" or asks for their "health monitoring."

**Severity:** High and systemic. It doesn't crash anything; it quietly makes the premium promise a lie, which is the specific death Volume I warns about — customers leave over inconsistency, not dirty windows.

**Evidence:** `SQUEEGEEKING_TIERS` benefit arrays in `tier-config.ts`; the technician app and health checks are unbuilt (roadmap); Law 011. Wargame 004 named the guarantee *button* and the comms *engine* as missing builds; it did not name the benefits list itself as a set of undefined, unmeasured SLAs. That reframe is the finding.

**Smallest change that prevents it:** Write one sentence of operational definition per benefit ("VIP Priority Scheduling = booked within X days of request; measured how; owned by whom"), and strike or relabel any benefit the company cannot actually deliver this year ("Property Health Monitoring" → what it truly is in year one). A definition audit of the agreement, an afternoon's work, done before member 101.

**Belongs in:** Product (surface owner: 3.4.8 Estimates & Agreements) and the Standard (a benefit printed on an agreement must have a definition and an owner before it ships).

---

## 4 — The flagship tier's "complimentary every visit" is untracked cost of goods

**Why it matters:** Quarterly — the highlighted, "most popular," white-glove tier — promises "Complimentary RainBlock Technology (every visit)" and "Complimentary Hard Water Stain Removal (every visit)." The agreement math presents these at $95 + $75 = $170 of retail value per visit, $680/year, as *included*. Retail value is a sales number; the *cost* to actually apply RainBlock and hard-water treatment four times a year to every quarterly member is real product and labor, and it is tracked nowhere. Nothing in the corpus measures per-tier margin or cost of goods. The company could be losing money on every member of its best-selling tier for twelve months and only discover it at an annual reckoning — if anyone runs one.

**When it first appears:** Day one, silently. Damage compounds invisibly and is only detectable if someone deliberately computes tier-level margin, which no surface does.

**Severity:** High cumulative, low acuteness — the most dangerous shape, because nothing alerts. The pricing engine was built for *consistency and trust* (Standard 3.4.5), which is the right north star and the reason no one is watching *profitability per tier*.

**Evidence:** `RAINBLOCK_RETAIL_VALUE = 95`, `HARDWATER_RETAIL_VALUE = 75` in `tier-config.ts`; Quarterly benefits list; `includedTreatments` in agreement pricing; HQ CEO Scoreboard tracks "Revenue collected" and ARR — never cost. Wargame 004's pricing findings were about the settings *fork* and locked-pricing policy; wargame 006 was about commoditization. Neither asked whether the flagship tier is profitable. That's the gap.

**Smallest change that prevents it:** One spreadsheet, once: actual material + labor cost to deliver a Quarterly visit including both treatments, subtracted from the Quarterly visit price. If the margin is thin or negative, that is a founder decision to make with eyes open — not a discovery to make in month twelve.

**Belongs in:** Business (and a Standard note: the pricing engine owns consistency; something must own margin, or "trust-first pricing" quietly becomes "unprofitable pricing").

---

## 5 — Chargeback defense requires evidence three systems don't share

**Why it matters:** Billing a stored card with no human present guarantees disputes: "I never authorized this," "you didn't show up," "I cancelled." Each is a chargeback. Winning a chargeback requires assembling, on a deadline, three things: proof of authorization (the signed agreement), proof of the charge (Stripe), and proof of delivery (the completed visit). In HomeAtlas these live in three disconnected places — `signed_agreements` in Supabase, the charge in Stripe, the completed job in Jobber — with no object linking a specific charge to the specific visit it paid for. The company will lose winnable disputes for lack of assembled evidence. Worse: if the chargeback ratio climbs (and unscheduled members from finding #1 will dispute), the payment processor can restrict or terminate the account — and a company that cannot bill any card is a company that has stopped existing.

**When it first appears:** Month 2–3, the first dispute after real billing begins.

**Severity:** High, with an existential tail (processor termination). Individually survivable; in a cluster, fatal.

**Evidence:** `signed_agreements` table (Supabase), Stripe payment records (separate), Jobber completion (Standard §3.8, separate), and no linking record among them anywhere in the corpus. Wargame 002 covered the setup-intent/activation reconciliation; it did not cover *dispute evidence assembly*, which is a different seam.

**Smallest change that prevents it:** Decide, now, the manual chargeback playbook: where each of the three proofs lives, who assembles them, and the response deadline — written down before the first dispute, not discovered during one. One page. And keep the chargeback ratio itself on the founder's dashboard so the existential tail is visible before it arrives.

**Belongs in:** Operations (the playbook) with a Business owner watching the ratio.

---

## 6 — Payment status and dispatch never reconcile: the arrears truck

**Why it matters:** Billing happens on the 1st of the service month; the visit happens later that month; field payment collection is forbidden by the Standard ("technicians care for homes, not collect payments"). So consider the ordinary case: a card fails on the 1st, the member doesn't fix it, and a visit is already on the Jobber route for the 15th. Nothing connects "this member's payment failed" (HomeAtlas/Stripe) to "pull them from the route" (Jobber). The truck rolls, the tech performs the service — and by doctrine cannot even mention money at the door. The company has performed free work and forbidden itself the only field-level remedy. This is distinct from dunning (wargame 004, the retry emails) and from the reschedule/billing coupling (004): it is the unbuilt reconciliation between *payment state* and *dispatch decision*.

**When it first appears:** Month 2 — the first failed payment ahead of a scheduled visit.

**Severity:** Medium-High. Each instance is a free visit plus an awkward, doctrine-violating doorstep or a silently-absorbed loss. It scales linearly with the decline rate.

**Evidence:** Billing-on-the-1st and no-field-collection (Standard Volume VI Membership Billing; `agreement-content.ts`); Jobber owns dispatch (§3.8); membership/payment status lives in Supabase/Stripe; no link between a failed charge and a scheduled route exists in the corpus.

**Smallest change that prevents it:** A manual pre-dispatch check: before the week's routes go out, one person cross-references failed payments against scheduled visits and pulls or holds the affected stops. A defined step in the weekly operating rhythm — not software — until the systems connect.

**Belongs in:** Operations (with the outcome policy — do we ever knowingly serve an in-arrears member? — set in the Standard/Business).

---

## 7 — The add-on discount suspension clause cannot be honored

**Why it matters:** The signed add-on fine print states, verbatim, that the member discount "will be suspended immediately upon any lapsed or failed payment and reinstated upon payment resolution." Honoring that sentence requires the system to know, at the moment an add-on is sold in the field, whether the member's payments are current — and to apply or withhold 20–25% accordingly, then reinstate on resolution. None of that machinery exists, and the field lacks payment-status visibility by design (finding #6). So the company will apply the discount when the contract says to suspend it, or charge full price when payments are actually current — either way, billing an amount that contradicts its own signed terms. Wrong charges on a contract clause are a refund magnet and a trust wound, and in aggregate a consumer-billing-accuracy exposure.

**When it first appears:** Month 2–3, the first add-on sold to a member with a payment hiccup.

**Severity:** Medium. Lower frequency (needs a failed payment *and* an add-on sale to coincide), but each instance is a provable contradiction between what was signed and what was charged.

**Evidence:** `ADDON_DISCOUNT_FINE_PRINT` in `tier-config.ts` (exact suspension/reinstatement language); no point-of-service payment-status mechanism anywhere; the member add-on discount percents (`memberAddOnDiscount`) exist in pricing with no enforcement of the suspension condition.

**Smallest change that prevents it:** Either soften the clause to what operations can actually deliver (a legal-review item, folds into #2), or write the manual rule: no add-on discount is applied in the field without an explicit current-status check owned by the office. Cheapest honest fix is to align the promise to reality, not the reverse.

**Belongs in:** Legal (fix the clause) + Operations (until then, the manual rule).

---

## 8 — Cash flow is lumpy by design, with no cash-position visibility

**Why it matters:** Billing cadence equals service cadence: a bi-annual member generates cash twice a year, a quarterly member four times. If the launch cohort skews bi-annual, or simply clusters (everyone onboarded in the same launch window bills in the same months), revenue arrives in waves while cost of goods — chemicals, fuel, labor, and any new hire — is continuous. Headquarters shows "Revenue collected" and ARR; it shows no cash position and no runway. A two-founder company with thin capital can be ARR-healthy and cash-broke in the same month, and the dashboard built to give the founder truth would not show it.

**When it first appears:** Month 2–4, the first low-billing month against continuous costs.

**Severity:** Medium, with a real existential edge for an undercapitalized operator — a cash trough doesn't care how good the ARR is.

**Evidence:** ARR multipliers (bi-annual ×2, quarterly ×4) in `tier-config.ts`/architecture; billing tied to service month (Standard); HQ CEO Scoreboard surfaces collected revenue and ARR, not cash or runway. Wargame 004 named the *forward revenue calendar* as a founder-experience gap; it did not name the *cash-trough-against-continuous-COGS* risk or the dashboard's revenue-not-cash blind spot.

**Smallest change that prevents it:** A monthly cash-in / cash-out / balance number the founder actually looks at — a spreadsheet, weekly. And in the near term, a deliberate choice about cohort mix and billing-month spreading so the company doesn't stack all its bi-annual bills into the same two months. A decision plus a number, not a feature.

**Belongs in:** Business (with a quiet note against the HQ Scoreboard: "collected" and "cash on hand" are different truths, and the founder needs both).

---

## 9 — No mechanism transmits the Standard to the first hire

**Why it matters:** 100 quarterly members is 400 visits a year. Two founders cannot perform them and also run the company; a technician hire in months 3–6 is not optional, it is arithmetic. That hire will hold the brand's single most sacred surface — the actual visit, the actual observation, the actual homeowner at the door — and they will do so having never read the Standard, possibly never hearing of it. Volume II insists culture is "demonstrated daily," "not delegated," and that the company hires *builders, not employees* — but there is no onboarding, no apprenticeship against the record, no way the philosophy reaches the person who now embodies it. The clarifications doc worried about the Standard surviving engineers who didn't write it; this is the same failure at the point of maximum consequence — the field, where the homeowner's entire experience of "someone is paying attention" is either honored or quietly betrayed by a stranger who was handed a squeegee and an address.

**When it first appears:** Month 3–6, at the first hire.

**Severity:** Medium in twelve months (one hire, limited blast radius), but a slow-fuse existential — this is precisely how a company with a beautiful constitution becomes average, "one small compromise at a time" (Volume II Ch. 4), starting with the first person who never learned there was a standard to hold.

**Evidence:** `team/founders.ts` (two founders); Volume II Chapters 4 and 6 ("Our Standard," "Builders, Not Employees") assert culture-by-demonstration with no transmission mechanism; the technician app is unbuilt, so even the tooling that might carry the Standard into the field doesn't exist; the clarifications doc established that the Standard is not reliably found even by people trying.

**Smallest change that prevents it:** Before the first hire works a solo visit, one founder rides with them for a defined number of visits, and the hire reads (or is walked through) the parts of the Standard that govern the field — the technician surface (3.4.6), the memory laws (001, 003), and the internal-vs-customer-notes rule. A defined apprenticeship minimum, written once. Not a training platform — a rule that says the first visits are never solo.

**Belongs in:** Operations (the apprenticeship rule) and the Standard (Volume II should name how culture is transmitted, not only assert that it must be).

---

## The shape of the missing operating system

Read the nine together and one system is missing, not nine unrelated holes. HomeAtlas has built, beautifully, the **front** of the company — acquire, present, sign, remember — and has assumed the **middle**:

- **Fulfillment** — the loop from signed member → scheduled → served → proven (findings 1, 6, 9).
- **Money-in-motion** — the loop from billed → collected → reconciled → defensible (findings 5, 6, 7, 8).
- **Promise integrity** — the loop from what-we-sold → what-we-can-deliver → what-we-can-prove (findings 2, 3, 4, 7).

None of these are features to design; they are *operating loops to own*. The corpus is rich in philosophy about the home and the record, and nearly silent on the unglamorous middle where a service company actually lives or dies: getting the truck to the right house, on a member who has paid, to deliver exactly what was promised, provably enough to survive a dispute — and knowing, at month's end, whether any of it made money.

The company will not break in the first year because its philosophy is wrong. It will break in the seam between the signature and the squeegee. That seam is the operating system that hasn't been written yet, and at 100 members it stops being theoretical on week one.

---

*Filed as wargames/007. Findings only; no features proposed. Every "smallest change" is an owner, a definition, a legal errand, a spreadsheet, or a rule — deliverable before member 101. If the company builds nothing from this list and only assigns owners to the nine loops, it survives the year.*
