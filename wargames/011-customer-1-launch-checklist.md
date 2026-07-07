# WARGAME 011 — Customer #1 Launch Checklist

*The runbook Noah executes to sell and onboard the first real SqueegeeKing HomeAtlas membership. Not a plan — a checklist. Run it top to bottom. Every item has an owner, a tool, a pass condition, a failure condition, and a recovery action.*

**Grounded in what actually shipped** (per `docs/CORPUS_ALIGNMENT_REPORT.md`): live path is **presentation → sign → agreement PDF → card on file (SetupIntent) → portal token → welcome email → PWA install**. **Not shipped, run by hand:** recurring billing (no engine, no webhook), sign→Jobber scheduling handoff. Those are the MANUAL steps below; see `wargames/010` for the standing procedures.

**Roles:** Noah (founder, in the room). Ops (whoever runs Supabase/Stripe/Jobber — may also be Noah tomorrow). Both logins must exist and be tested *before* the meeting.

**The three lights, decided before Noah drives to the customer:**

### 1. GREEN — proceed to sign
All of: Production check = `production`; Stripe **live** keys; Resend sending from a **verified domain**; Supabase reachable with all migrations applied; agreement legal-reviewed (or Noah accepts the documented risk in writing); a signed-agreement bucket that is **not** public; the manual billing owner + Billing Register ready; insurance active. → Sell.

### 2. YELLOW — proceed with a named manual backstop, not blind
Any single non-fatal gap that has a **written backup plan and an owner**: Resend on sandbox sender (→ hand-deliver PDF, §Backups); email unverified but PDF downloadable; PWA install flaky (cosmetic); reviews not connected (cosmetic). → Sell **only** if each yellow item has its backup plan open on a second device.

### 3. RED — abort the signing, keep the relationship
Any of: Stripe in **test** mode; Supabase unreachable or migrations missing; signed-agreement bucket **world-readable**; access codes/gate notes rendering on the portal; no card-on-file path working in a rehearsal; agreement legally unreviewed **and** Noah unwilling to accept the risk; no one owns the manual first-month charge. → Do **not** sign today. Use the graceful exit (§Backups D). The relationship survives; a broken first membership does not.

---

## Phase 0 — Pre-flight (the night before / morning of)

Run every row. A RED row is a launch-blocker.

| # | Item | Owner | Tool | Pass | Failure | Recovery |
|---|------|-------|------|------|---------|----------|
| 0.1 | Production check | Noah | `/hq/production-check` | mode = `production`; supabase/storage/resend/stripe/persistence all green | `degraded` or `development` | Read which flag is red; fix that env var; re-run. If storage/stripe red → RED light |
| 0.2 | Stripe live mode | Ops | Vercel env + Stripe dashboard | `STRIPE_SECRET_KEY` = `sk_live_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_…`, same account | test keys present | Swap to live keys, redeploy. Until then → RED |
| 0.3 | Supabase configured + enabled | Ops | Vercel env | `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` set; `NEXT_PUBLIC_SUPABASE_ENABLED=true`; `PERSISTENCE_BACKEND=supabase` | any missing → app silently uses session/local store | Set env, redeploy, re-verify with 0.4. Until then → RED |
| 0.4 | Migrations applied | Ops | Supabase SQL editor (query Q1) | all core tables + `portal_access_token`, `onboarding_status`, `payment_setup_completed_at` present | a table/column missing | Run the missing migration from `lib/persistence/supabase/migrations/`. Until then → RED |
| 0.5 | Resend sending domain | Ops | Vercel env + Resend dashboard | `RESEND_API_KEY` set; `RESEND_AGREEMENT_FROM` = verified-domain address | unset (→ sandbox `onboarding@resend.dev`, delivers only to account owner) | Verify domain in Resend, set env. If not possible today → YELLOW + hand-deliver backup (§Backups A) |
| 0.6 | Signed-agreement bucket not public | Ops | Supabase Storage | `signed-agreements` bucket **not** public, or serves only via signed URL | bucket world-readable | This is a privacy breach for a real contract → **RED** until closed (wargame 001 Phase 2) |
| 0.7 | Portal token is unguessable | Ops | Supabase (query Q6) | `portal_access_token` is a random token, not the slug | token is a name-slug | RED — portal is publicly guessable (wargame 001 Phase 5) |
| 0.8 | Admin PIN not world-open | Ops | Vercel env | `NEXT_PUBLIC_ADMIN_PIN` set to a real value | unset → HQ APIs open | Set PIN, redeploy |
| 0.9 | Presentation ready & email correct | Noah | `/presentations/[id]/edit` | client name, **email (spelled right)**, address, sqft, tier all correct | blank/typo email | Fix before signing — every email (agreement, welcome, receipt) depends on it (wargame 002 P9) |
| 0.10 | Full dry-run done | Noah | production, fake member, Noah's own card | complete flow passed end-to-end, then cleaned up (Q-cleanup) + Stripe test customer deleted | any step failed in rehearsal | Fix the failing step; do not sell until a clean rehearsal passes |
| 0.11 | Manual billing owner + Register | Noah | wargame 010 §3 | a named person owns the 1st-of-month charge run; Billing Register exists | nobody owns it | RED — a card on file that no one charges is not revenue (there is no billing engine) |
| 0.12 | Insurance active | Noah | policy docs | GL + workers-comp active before any non-founder visit | lapsed/absent | RED for any tech visit; if Noah performs it himself, note the exposure |
| 0.13 | Device + network for the meeting | Noah | the actual device | present-mode loads, signature pad works, Stripe element renders on that device | fails on device | Switch device; rehearse again |

**Q1 — migrations/tables present:**
```sql
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
-- must include: homeowners, properties, memberships, signed_agreements,
-- presentations, home_care_plans, property_assets
select column_name from information_schema.columns
where table_name = 'memberships'
  and column_name in ('portal_access_token','payment_setup_completed_at','status','stripe_customer_id');
-- all four must return
```

---

## Phase 1 — In the room (what Noah does and says)

| # | Item | Owner | Tool | Pass | Failure | Recovery |
|---|------|-------|------|------|---------|----------|
| 1.1 | Present the plan | Noah | `/presentations/[id]/present` | deck loads to cover; pricing slide shows the numbers Noah expects | wrong price on a slide | **STOP before the close slide** — abort (§Backups D). Wrong price signed into a PDF is unrecoverable |
| 1.2 | Customer chooses tier | Customer | close slide | tap opens signing with tier pre-selected | — | — |
| 1.3 | Review + sign | Customer | signing flow | agreement summary price == pricing-slide price; signature captured | mismatch | STOP, abort (§Backups D) |
| 1.4 | Submit agreement | Noah | `/api/sign-agreement` | success in ~5–10s; response has `agreementId`, `pdfUrl` | >20s or error | Recovery per §Backups B (agreement) |
| 1.5 | Card on file | Customer | Stripe element | element loads; card confirms; **$0 charged today** | element blank / card declined | §Backups C (payment) |
| 1.6 | Confirm to customer | Noah | in person | "Signed and safe. Your copy's in your email. Nothing charged today — you're billed on the 1st of your service month." | — | — |

**What Noah says in person (the script that keeps it care, not accounting):**
- On the card step: *"This just puts your card securely on file — nothing is charged today. Your first payment is on the 1st of the month we visit, and there's never a payment at the door."*
- On the portal: *"You'll get a welcome email with a private link to your home's page — where you'll see your visits and photos over time."*
- On what's next: *"We'll have your first visit on the calendar within a couple of days, and I'll let you know who's coming."*
- Never: what they've spent, "investment," or anything about the software by name.

---

## Phase 2 — What Noah checks after signing (before he leaves the driveway)

Run the **Founder Acceptance Test** — [`docs/operations/FOUNDER_ACCEPTANCE_TEST.md`](../docs/operations/FOUNDER_ACCEPTANCE_TEST.md) — on his phone: **FAT-1**, **FAT-2**, **FAT-3** (replace `<PRESENTATION_ID>`). One-line gate: all FAT-1 `check_*` = PASS, FAT-2 zero rows, FAT-3 all `portal_*` = PASS.

| # | Item | Owner | Tool | Pass | Failure | Recovery |
|---|------|-------|------|------|---------|----------|
| 2.1 | Membership created & active | Noah | FAT-1 `check_membership_active` | PASS | FAIL / `pending_payment` | If card was added: §Backups C recovery. If not: send payment link (§Backups C) |
| 2.2 | Agreement saved & linked | Noah | FAT-1 `check_agreement_stored`, `check_agreement_pdf_in_storage` | both PASS | FAIL / data-url | §Backups B |
| 2.3 | Portal token works | Noah | FAT-1 `check_portal_token` + open `/portal/[token]` | PASS + portal renders | 404 / error | §Backups B (portal) |
| 2.4 | No secrets on portal | Noah | the portal page + FAT-3 | no gate codes; FAT-3 all PASS | any secret or fabricated visit/savings | **Do not share the link.** ESCALATE, hold portal until fixed |
| 2.5 | Obligations generated | Noah | FAT-1 `check_obligations_created` | PASS | FAIL | Re-run setup-payment (idempotent); confirm `018_obligations.sql` applied |
| 2.6 | No duplicates | Noah | FAT-2 | zero rows | any row | Keep earliest complete row; ESCALATE before deleting |
| 2.7 | Emails sent | Noah | Resend log | agreement email `sent`; welcome email queued/sent | `skipped`/`failed` | §Backups A |
| 2.8 | Customer has their copy | Customer | their phone | confirms agreement email arrived, PDF opens | not received | §Backups A — hand-deliver before Noah leaves |

---

## Phase 3 — The next morning

| # | Item | Owner | Tool | Pass | Failure | Recovery |
|---|------|-------|------|------|---------|----------|
| 3.1 | Founding-member flag set | Ops | Q4 | launch-cohort member carries founding-member status | missing | Set it now — **cannot be granted honestly later** (wargame 010 §6.2) |
| 3.2 | Payment truly settled | Ops | Stripe dashboard | one customer, one payment method, default set, **zero charges** today | duplicate customer / no PM | If duplicate: note it (idempotency gap, wargame 002); keep the one with the PM. If no PM: §Backups C |
| 3.3 | Enter into Billing Register | Ops | wargame 010 §3 | member logged with service month + `visit_price` + `stripe_customer_id` | not logged | Log it — this is how the 1st-of-month manual charge finds them |
| 3.4 | Enter into Obligation Register | Ops | wargame 010 §8 | visits owed for the year recorded (from `visits_per_year`) | not logged | Log it — this is how "promised vs delivered" stays honest |
| 3.5 | Chargeback evidence filed | Ops | folder | agreement PDF + Stripe charge ref + (later) visit proof kept together | scattered | Assemble now while it's fresh (wargame 007 §5) |

**Q4 — founding member + register inputs:**
```sql
select h.full_name, m.id, m.sales_tier, m.visit_price, m.visits_per_year,
       m.stripe_customer_id, m.founding_member, m.created_at
from memberships m join homeowners h on h.id = m.homeowner_id
where m.created_at > now() - interval '48 hours';
-- if founding_member column/flag is absent, record founding status in the Register manually and ESCALATE to add it
```

---

## Phase 4 — Before the first visit (the sign→schedule handoff — MANUAL)

**Owner: Ops. SLA: first visit on the Jobber calendar within 2 business days of signing.** This is the seam that most often breaks (wargame 007 §1) — it has one owner, no exceptions.

| # | Item | Owner | Tool | Pass | Failure | Recovery |
|---|------|-------|------|------|---------|----------|
| 4.1 | Member is paid-set before booking | Ops | Q2 | `status = active` with card on file | `pending_payment` | Do not book until card recovered (§Backups C) |
| 4.2 | Book first visit in Jobber | Ops | Jobber | client + property + first job created; address **exactly** matches `properties.address` | typo / no booking | Fix address (address is the only Jobber↔HomeAtlas link); book |
| 4.3 | Cadence correct | Ops | Jobber vs Q4 | jobs booked match `visits_per_year` (Quarterly 4 / Bi-Annual 2) | wrong count | Correct in Jobber |
| 4.4 | Service month set deliberately | Ops | Jobber + Billing Register | visit month == the month you intend to bill | mismatch | Align — billing follows the service month |
| 4.5 | No duplicate Jobber client | Ops | Jobber search | one client for this member | duplicate | Merge before dispatch |
| 4.6 | Booking communicated | Noah/Ops | text/email | member told the date/window + who's coming | silence | Send templated confirmation (care, not accounting) |

---

## Phase 5 — After the first visit

| # | Item | Owner | Tool | Pass | Failure | Recovery |
|---|------|-------|------|------|---------|----------|
| 5.1 | Visit documented same day | Tech→Ops | field form → `service_observations` | ≥1 observation/photo/recommendation entered; internal vs customer marked | nothing entered | Enter same day — a visit with no memory is incomplete (Law 003) |
| 5.2 | No fabricated data | Ops | the entry | only what was seen; blanks left blank | invented score/date | Delete the guess; leave blank (Rule 3) |
| 5.3 | Obligation Register updated | Ops | wargame 010 §8 | one owed visit marked delivered | not updated | Update — keeps promised-vs-delivered true |
| 5.4 | 7-day guarantee window opened | Ops | calendar | 7-day clock noted; member knows how to flag an issue | no owner | Assign the clock; a proactive check-in is the strongest trust move |
| 5.5 | Portal reflects the visit | Ops | `/portal/[token]` | member-appropriate observation visible; no internal notes leaked | internal note shown | Re-mark audience; fail closed to internal |
| 5.6 | Next visit pre-booked | Ops | Jobber | next cadence visit on the calendar | gap | Book it — the rhythm holds without the member having to ask |

---

## Backup Plans (customer-facing, if a system fails)

The agreement is valid the moment it's signed and stored — **email, portal, and payment are delivery mechanisms, not validity.** Never re-run the signing flow to "fix" a delivery failure; that creates a duplicate agreement and a second email.

### A — Email fails (agreement or welcome not delivered)
- **Signal:** Q2 email field `skipped`/`failed`, or member reports nothing arrived.
- **Say:** *"Your agreement is signed and safe — I'll send your copy myself within the hour."*
- **Do:** pull the PDF from `agreement_pdf_url` (Q2) or Supabase Storage `signed-agreements`; email it from the company address by hand. Fix `RESEND_AGREEMENT_FROM` (verified domain) before Customer #2.
- **Not an abort.** Continue to the card step.

### B — Portal / PDF link broken
- **Signal:** `/portal/[token]` 404s, or `pdf_url` is a data-URL / dead.
- **Say:** *"Your home's page is being set up — I'll text you the link today."*
- **Do:** confirm `portal_access_token` exists (Q6); if the PDF is a data-URL, storage upload failed → re-fetch bytes and store, or hand-send the PDF (§A). ESCALATE if the token is missing.

### C — Stripe fails (element won't load or card declines)
- **Element blank (config):** do not debug in the room. *"I'll text you a secure link tonight to add your card."* Membership sits `pending_payment` — a **designed** state, not an error. Send the payment-setup link (SetupIntent flow is reusable). Book the first visit only after the card is on (Phase 4.1).
- **Card declined (bank):** *"No problem — try another card, or I'll send a secure link for later."* Retry once; if it fails twice, fall back to the link.
- **Never** take card numbers verbally or on paper.
- **Recovery (later):** in Stripe, if a succeeded SetupIntent + payment method exists but membership is still `pending_payment`, complete activation:
  ```
  POST /api/membership/setup-payment
  { "membershipId":"<id>", "paymentMethodId":"pm_…", "setupIntentId":"seti_…" }
  ```

### D — Graceful abort (RED light, wrong price, or repeated failure)
- **Say:** *"I want your paperwork perfect rather than fast. I'll finalize everything this afternoon and text you a link to review, sign, and add your card from your couch. Your pricing is locked."*
- The activation-link flow makes this literally true. Fix the cause, re-run Phase 0, send the link same day. The sale survives; a broken first membership does not.

### E — Agreement saved but membership didn't activate (F3/F5)
- **Signal:** Q2 shows `agreement_id` present but `membership_status = pending_payment` with no card.
- **Do:** reopen `/presentations/[id]/present` — the viewer detects incomplete onboarding (`/api/membership/onboarding-status`) and resumes at the right step. If a link-update silently failed (agreement exists, `memberships.agreement_id` null), fix with Q5 using both IDs from the same signing.

**Q5 — repair a broken agreement↔membership link (only with both IDs confirmed, same `signed_at`):**
```sql
update memberships set agreement_id = '<AGREEMENT_ID>' where id = '<MEMBERSHIP_ID>';
```

**Q6 — portal token check:**
```sql
select h.full_name, m.portal_access_token
from memberships m join homeowners h on h.id = m.homeowner_id
where m.id = '<MEMBERSHIP_ID>';
```

**Q-cleanup — remove the dry-run member after Phase 0.10 (identify first, never delete blind):**
```sql
select id from homeowners where full_name ilike 'test%' or slug like 'test-%';
-- then, scoped to that id:
delete from signed_agreements where homeowner_slug like 'test-%';
delete from memberships where homeowner_id in (select id from homeowners where slug like 'test-%');
delete from properties where homeowner_id in (select id from homeowners where slug like 'test-%');
delete from homeowners where slug like 'test-%';
-- Stripe: delete the live-mode test customer + detach the payment method
-- Storage: delete the test PDF from signed-agreements
```

---

## Launch decision — the one-line gate

**GREEN across Phase 0 → sell. Any YELLOW → sell only with that item's backup plan open on a second device. Any RED → graceful abort (§D), fix, re-run Phase 0.**

The final pass/fail after Customer #1 (from wargame 002): the Founder Acceptance Test passes on the first attempt (FAT-1 / FAT-2 / FAT-3 — see `docs/operations/FOUNDER_ACCEPTANCE_TEST.md`), the member has their PDF, Stripe shows one customer / one card / zero charges, the price matches across slide + agreement + DB, and the member is in both Registers. If all true — Customer #1 is real, correct, and provable. Then, and only then, Customer #2.

---

*Filed as wargames/011. Checklist only — no features, no philosophy. Every SQL query is runnable as-is against the current schema; every backup plan is a sentence Noah can say and a step Ops can take without waiting for software that isn't built.*
