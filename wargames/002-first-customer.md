# WARGAME 002 — First Real Customer Walkthrough

**Status:** PLAN ONLY. Operational test plan for Noah. No code changes required by this document.
**Mission:** Run one real homeowner through: Presentation → Agreement → Email PDF → Card on File → Active Membership → Supabase verification → Stripe verification.
**Precondition:** Wargame 001 phases 1–4 complete (or founders have explicitly accepted the documented risk of running before them). Phase 6 items 6.3/6.5 (no mock mode, live keys) are **non-negotiable** before a real card is entered.

---

## Part 1 — Preflight checklist (day before, ~45 minutes)

Run every item. Any ❌ = do not schedule the customer.

| # | Check | How | Pass looks like |
|---|-------|-----|-----------------|
| P1 | Production check page | Open `/hq/production-check` on **production** | `mode: "production"` — all five green: supabase, storage, resend, stripe, persistence |
| P2 | Stripe keys are live-mode | Vercel env: `STRIPE_SECRET_KEY` starts `sk_live_`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts `pk_live_` | Both live, from the same Stripe account |
| P3 | Mock payment disabled | Confirm Stripe envs set (mock only triggers when Stripe is unconfigured; if 001-6.3 shipped, also confirm `ALLOW_MOCK_PAYMENT` is **absent** in prod) | Activation without a real card is impossible |
| P4 | Resend sender | Vercel env `RESEND_AGREEMENT_FROM` is set to a **verified domain** address (e.g. `agreements@squeegeeking.net`), not the `onboarding@resend.dev` sandbox | Sandbox sender = emails may only deliver to the account owner — real customer would get nothing |
| P5 | Email branding decision | Read `lib/agreement/send-agreement-email.ts` subject/body: it says **"HomeAtlas"**, not SqueegeeKing | Founders either accept this knowingly for customer #1, or fix copy first. A customer who signed with SqueegeeKing receiving "Welcome to HomeAtlas" may read it as phishing. Decide *before*, not after. |
| P6 | Pricing sanity | In Supabase: `select settings from pricing_settings where id='default';` — diff against defaults in `lib/pricing/company-settings.ts` (001-R5) | Identical, or divergence understood and presentation numbers re-checked by hand |
| P7 | **Full dry run in production** with a fake customer ("Test Homeowner", Noah's own email, Noah's real card) | Execute Part 2 end-to-end exactly as scripted | Every step passes; then run the cleanup SQL (Part 6) and detach/delete the test payment method + customer in Stripe dashboard |
| P8 | Dry-run duplicate check | After P7: `select property_slug, count(*) from signed_agreements group by 1 having count(*) > 1;` | Zero rows |
| P9 | Presentation prepared | Presentation exists for the real customer: correct name, **email address entered** (this is what receives the PDF — a typo here silently kills delivery: blank email = `emailStatus: "skipped"`), address, sqft, tier, two-story/screens flags | Reviewed on the edit screen; Present mode click-through rehearsed |
| P10 | Device & venue | The device Noah presents on: charged, stable network (agreement signing round-trips the server; PDF generation + Stripe are online operations), browser tested | Present mode works on that exact device |
| P11 | Rollback notes printed | Part 4 failure playbooks + Part 6 SQL accessible on a second device/paper | Noah can act without debugging live in front of a customer |

---

## Part 2 — Customer-facing steps & what Noah should observe

The flow has two acts: the **pitch** (slides) and the **paperwork** (signing modal). Keep the device in Noah's hands for the paperwork act except the signature and card steps, which are the customer's.

| Step | Noah does | Customer does | **Noah observes (pass signal)** |
|------|-----------|---------------|-------------------------------|
| 1 | Open `/presentations/<id>/present` before arriving | — | Deck loads to cover slide with customer's name. Status quietly flips `draft → presented` after first advance (invisible; fine) |
| 2 | Walk slides with arrow keys / footer | Watches | Slides transition smoothly; pricing slide shows the numbers Noah expects from P9. **If any number surprises Noah — stop before the close slide** (see F7) |
| 3 | On close slide, customer chooses tier | Picks Bi-Annual or Quarterly | Tapping a tier button opens the signing flow with that tier pre-selected |
| 4 | Hand device over for signature | Reviews agreement summary, signs (draw or type) | Signature pad responds; agreement summary shows the **same per-visit price** as the pricing slide |
| 5 | Submit agreement | — | Success state within ~5–10s (PDF generation + storage + email happen in this request). **Note the moment**: if this takes >20s, the request may have timed out server-side while partially completing — treat as F3 |
| 6 | Card-on-file step | Customer enters card in the Stripe element | Stripe element loads (proves publishable key OK); confirm succeeds; **no charge occurs** — tell the customer explicitly: "this saves the card; you're billed on the 1st of your service month, $0 today" |
| 7 | Activation | — | Membership success/welcome state. This is the client calling `/api/membership/setup-payment` — the step most at risk of a closed-tab race. **Do not close the tab or navigate until the success state renders** |
| 8 | Confirm with customer | "You'll have the signed agreement in your email now" | Customer sees the email (subject: *"Your … Membership Agreement"*) with **PDF attached or working link** — have them open it on *their* phone before Noah leaves. This is the only end-to-end delivery proof that costs nothing |

**Timing budget:** steps 4–8 should total under 4 minutes. If the paperwork act drags past 10 minutes with retries, invoke the abort script (Part 5) — a smooth exit preserves the sale; a debugging session in the living room kills it.

---

## Part 3 — Failure modes (ranked by likelihood) 

| # | Failure | Where | Signal |
|---|---------|-------|--------|
| F1 | Email skipped — no/invalid customer email | Step 5 response | `emailStatus: "skipped"`, `emailReason: "no_valid_recipient_email"` |
| F2 | Email failed — Resend rejects (unverified domain, sandbox sender, bad key) | Step 5 | `emailStatus: "failed"`, `emailReason: "resend_error: …"` |
| F3 | Agreement partially saved (207) | Step 5 | HTTP 207; response has `membershipId` but error text; or >20s stall |
| F4 | Stripe element won't load / card declined | Step 6 | Element blank (publishable key/env) or decline message (customer's bank) |
| F5 | Card saved but activation didn't run (closed tab, network drop between SetupIntent success and `setup-payment`) | Step 7 | No success state; later: membership still `pending_payment` but Stripe shows a succeeded SetupIntent |
| F6 | Agreement saved but membership not activated (variant of F5, or `setup-payment` returned 4xx/5xx) | Step 7 | Signing succeeded earlier; activation errors |
| F7 | Pricing mismatch between slide, agreement summary, or PDF | Steps 2/4/8 | Numbers differ anywhere in the chain |
| F8 | Double-submit → duplicate agreement rows / duplicate emails | Step 5 (double-tap) | Customer gets two emails; SQL shows 2 rows |

---

## Part 4 — Playbooks

### If email fails (F1 / F2)

The agreement is **already signed and stored** — email is delivery, not validity. Do not re-run the signing flow (that creates a duplicate agreement, F8).

1. Note `emailStatus`, `emailReason`, `emailRecipient` from the response (visible in devtools network tab on `/api/sign-agreement`; or check Vercel logs for `[agreement-email]`).
2. **F1 (skipped):** the presentation had no valid email. Get the correct address from the customer on the spot.
3. **F2 (failed):** usually `RESEND_AGREEMENT_FROM` unverified or sandbox sender (preflight P4 missed).
4. **Manual delivery, same day:** fetch the PDF — from the response `pdfUrl`, or Supabase Storage → `signed-agreements` bucket (or via `select agreement_pdf_url from signed_agreements order by created_at desc limit 1;`) — and send it from the company email address with a personal note. There is no re-send endpoint; manual is the runbook.
5. Tell the customer at the table: "The agreement is signed and safe — I'll email your copy personally within the hour." Continue to the card step. **Email failure is not an abort.**

### If Stripe fails (F4)

1. **Element doesn't render:** env problem (publishable key). This should have been caught by P1/P7. Do not debug live — invoke the graceful-exit script (Part 5): the agreement is signed; card can be collected via an activation link later (the post-signing activation-link flow exists for exactly this).
2. **Card declined:** bank-side. Offer: try another card, or "no problem — I'll text you a secure link tonight to add the card." Membership sits in `pending_payment` — which is a *designed* state, not an error.
3. **SetupIntent errors mid-confirm:** retry once. If it fails twice, stop retrying (each retry risks confusing state) and fall back to the link-later path.
4. Never take card numbers verbally/on paper. The whole architecture exists so card data only ever touches Stripe.

### If agreement saves but membership doesn't activate (F3 / F5 / F6)

This is the "card saved, membership dead" scenario — worst customer optics, fully recoverable.

1. **Same sitting, if quick:** reopen `/presentations/<id>/present`. The viewer's recovery logic detects `pending_payment` / an incomplete onboarding and reopens the signing flow at the right step (it checks `/api/membership/onboarding-status` on mount). Often this completes activation in one tap.
2. **Later, from HQ:** confirm state:
```sql
select m.id, m.status, m.payment_setup_completed_at,
       m.stripe_customer_id, m.stripe_payment_method_id,
       p.onboarding_status
from memberships m
left join presentations p on p.membership_id = m.id
order by m.created_at desc limit 5;
```
3. In the Stripe dashboard, open the customer (search by name/email or the `stripe_customer_id` above). If a **succeeded SetupIntent** with an attached payment method exists → activation just never ran. Complete it manually:
```
curl -X POST https://<prod-domain>/api/membership/setup-payment \
  -H "Content-Type: application/json" \
  -d '{"membershipId":"<id>","paymentMethodId":"<pm_…>","setupIntentId":"<seti_…>"}'
```
   (`pm_…` and `seti_…` are both visible on the SetupIntent in the dashboard.)
4. If **no** succeeded SetupIntent exists → the card was never saved. Send the customer the activation link to add the card at home. No card data exists anywhere; nothing to clean.
5. **F3 specifically (207 partial):** the response's `membershipId`/`agreementId` fields say exactly which writes landed. Verify with the Part 6 SQL; if the agreement row exists but `memberships.agreement_id` is null (the link-update step failed and only logged), record both IDs and link manually:
```sql
update memberships set agreement_id = '<agreement_id>' where id = '<membership_id>';
```
   Do this only with both IDs confirmed from the same signing (check `signed_at` timestamp matches).

### If duplicates appear (F8)

```sql
select id, created_at, plan_name from signed_agreements
where property_slug = '<slug>' order by created_at;
```
Keep the earliest complete row. Do not delete the duplicate during the visit — mark it and clean up afterward (delete the later `signed_agreements` row; memberships auto-dedupe via the `property_id` upsert). Tell the customer to ignore the second email.

---

## Part 5 — Abort conditions & the graceful exit

Abort the **live session** (not the sale) when:

- A1: The presentation shows wrong pricing (F7) — abort *before* the close slide. Wrong numbers signed into a PDF is the one unrecoverable trust error.
- A2: Signing fails twice with a 5xx.
- A3: Stripe element fails to render at all.
- A4: Total paperwork time exceeds ~10 minutes of visible fumbling.
- A5: Anything suggests data went to the wrong record (another customer's name/address appears anywhere — this would indicate the slug-collision bug; freeze everything, screenshot, do not continue).

**Graceful exit script (customer hears confidence, not failure):**
> "I want your paperwork to be perfect rather than fast — I'll finalize your agreement this afternoon and text you the link to review, sign, and add your card from your couch. Your pricing is locked."

The activation-link flow makes this literally true. Then: fix cause at HQ, run P7 dry-run again, send the link the same day.

**A5 aside, if it fires:** two customers with similar names can merge records (`onConflict: slug` on name-derived slugs). Verify `select * from homeowners where slug = '<slug>';` shows only your customer's data before sending any link.

---

## Part 6 — Final verification SQL (run within 1 hour of the visit)

Replace `<PRESENTATION_ID>` (from the presentation URL).

**Master join — one row, every linkage:**
```sql
select
  p.id                          as presentation_id,
  p.status                      as presentation_status,      -- expect 'signed'
  p.onboarding_status,                                        -- expect 'complete'
  h.slug                        as homeowner_slug,
  h.email                       as homeowner_email,           -- expect the real email
  pr.slug                       as property_slug,
  m.id                          as membership_id,
  m.status                      as membership_status,         -- expect 'active'
  m.payment_setup_completed_at,                                -- expect not null
  m.sales_tier, m.visit_price, m.annual_rate, m.visits_per_year,
  m.stripe_customer_id,                                        -- expect 'cus_…'
  m.stripe_payment_method_id,                                  -- expect 'pm_…'
  m.agreement_id                as membership_agreement_link,  -- expect = sa.id
  sa.id                         as agreement_id,
  sa.signed_at, sa.ip_address,
  sa.agreement_pdf_url,                                        -- expect https (or storage path per 001-P2)
  sa.status                     as agreement_status            -- expect 'complete'
from presentations p
left join homeowners  h  on h.id  = p.homeowner_id
left join properties  pr on pr.id = p.property_id
left join memberships m  on m.id  = p.membership_id
left join signed_agreements sa on sa.id = p.agreement_id
where p.id = '<PRESENTATION_ID>';
```

**Uniqueness (all must return zero rows):**
```sql
-- one agreement per property
select property_slug, count(*) from signed_agreements
group by 1 having count(*) > 1;

-- one membership per property (enforced by upsert, verify anyway)
select property_id, count(*) from memberships
group by 1 having count(*) > 1;

-- no orphaned pending memberships with a saved customer (F5 sweep)
select id, status, stripe_customer_id from memberships
where status = 'pending_payment' and stripe_customer_id is not null;
```

**Pricing cross-check (F7 tripwire):**
```sql
select m.visit_price, m.annual_rate, m.visits_per_year,
       (m.visit_price * m.visits_per_year) as computed_annual
from memberships m where m.id = '<membership_id>';
-- computed_annual must equal annual_rate, and visit_price must equal
-- the number on the presentation's pricing slide (Noah confirms by eye)
```

**Stripe dashboard verification (manual, 2 minutes):**
1. Customer exists; `metadata.membership_id` matches the membership row.
2. Exactly **one** customer for this email (search the email — duplicates = 001-6.1 not shipped, note it).
3. One payment method attached; customer `invoice_settings.default_payment_method` is set to it.
4. SetupIntent status `succeeded`; **zero PaymentIntents / zero charges** (nothing billed today).

**Email verification:** customer confirmed receipt on their device (step 8), attachment opens, name/tier/price in the PDF are correct.

---

## Part 7 — Production-ready pass/fail criteria

**PASS — the system is cleared for regular customer onboarding — only if ALL of:**

1. Master join returns one row with every `expect` satisfied, on the **first** attempt (no manual SQL surgery mid-flow).
2. Zero duplicate rows in all three uniqueness queries.
3. Email delivered to the customer's real inbox with a working PDF (no manual re-send needed).
4. Stripe shows exactly one customer, one saved card, default payment method set, zero charges.
5. `visit_price` on the membership == price shown on the slide == price in the PDF (three-way match).
6. Total customer-visible paperwork time ≤ 4 minutes, zero visible errors.
7. The Part 6 sweep for orphaned `pending_payment` rows is empty.

**CONDITIONAL PASS** (onboard slowly, fix within the week): everything above succeeded but required exactly one playbook intervention (manual email send, or one recovery-flow resume). The playbook working *is* part of the system — but it should be rare, not routine.

**FAIL — halt onboarding, return to wargame 001 backlog — if ANY of:**

- Manual SQL was needed to link agreement ↔ membership.
- Duplicate agreements, duplicate Stripe customers, or duplicate emails occurred.
- Any pricing number differed anywhere in the chain (slide, summary, PDF, DB).
- The customer saw an error state Noah couldn't gracefully script around.
- Any data from another customer/test record appeared (A5).

Record the outcome (pass/conditional/fail + timestamps + any playbook used) at the bottom of this file after the run. That log is the seed of the real operations runbook.

---

## Appendix — Test-data cleanup (after P7 dry run only)

```sql
-- Identify the test rows first; never run deletes blind.
select id from homeowners where slug like 'test-%' or full_name ilike 'test %';

delete from signed_agreements where homeowner_slug like 'test-%';
delete from memberships where homeowner_id in (select id from homeowners where slug like 'test-%');
delete from home_care_plans where homeowner_slug like 'test-%';
delete from properties  where homeowner_id in (select id from homeowners where slug like 'test-%');
delete from homeowners  where slug like 'test-%';
-- presentations: set the test presentation back or delete it from /presentations UI
```
Stripe: detach the payment method and delete the test customer in the dashboard (live-mode test data must not linger).
Storage: delete the test PDF from the `signed-agreements` bucket.
