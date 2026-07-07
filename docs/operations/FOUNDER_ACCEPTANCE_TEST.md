# Founder Acceptance Test

**Version 1.0 · July 2026**

The canonical SQL acceptance suite for proving a real membership is correct before Noah leaves the driveway and before the next customer is sold.

**Related documents**

- [`wargames/011-customer-1-launch-checklist.md`](../../wargames/011-customer-1-launch-checklist.md) — full launch runbook (in-room script, backups, Jobber handoff, registers).
- [`docs/OPERATING_MANUAL.md`](../OPERATING_MANUAL.md) — standing procedures (daily rhythm, visit close-out, promise ledger). Part 1.3: *"Done looks like: The member could open their portal tonight and see a new chapter — with no fake data and no accounting."*

**How to run**

1. Open Supabase → SQL Editor (phone works).
2. Replace `<PRESENTATION_ID>` with the UUID from `/presentations/[id]` (same ID used in the launch checklist).
3. Run **FAT-1**, then **FAT-2**, then **FAT-3** in order.
4. Gate on the one-line rule at the bottom before sharing the portal link or selling Customer #2.

---

## Before Customer #1

Complete **before** Noah is in the room. Any RED item → do not sign today (see wargame 011 §Launch decision).

| # | Item | Tool | Pass |
|---|------|------|------|
| B1 | Production check | `/hq/production-check` | `mode = production`; supabase, storage, resend, stripe, persistence green |
| B2 | Stripe live mode | Vercel + Stripe dashboard | `sk_live_…` / `pk_live_…` on production |
| B3 | Migrations applied | wargame 011 Q1 | Core tables + `portal_access_token`, `onboarding_status`, `payment_setup_completed_at`, `obligations` |
| B4 | Signed-agreement bucket private | Production check `storageSafe` | Not world-readable |
| B5 | Resend on verified domain | Vercel + Resend | `RESEND_API_KEY` set; `RESEND_AGREEMENT_FROM` verified |
| B6 | Lead notify (if `/request` live) | Vercel | `LEAD_NOTIFY_EMAIL` set for production |
| B7 | Presentation correct | `/presentations/[id]/edit` | Name, **email**, address, sqft, tier — no typos |
| B8 | Full dry-run | Production + Noah's card | End-to-end pass, then wargame 011 Q-cleanup |
| B9 | Manual billing owner | Operating Manual + wargame 010 §3 | Named owner + Billing Register ready |
| B10 | Device rehearsal | Actual meeting device | Present mode, signature pad, Stripe element |

---

## FAT-1 — Master post-sign verification

Sections **1–4** read from this single query. One result row; inspect the `check_*` columns listed in each section below.

### FAT-1 SQL

```sql
-- Customer #1 post-sign checklist — Query 1
-- Replace <PRESENTATION_ID> with the presentation UUID from HQ / the URL bar.

with ctx as (
  select
    p.id                         as presentation_id,
    p.status                     as presentation_status,
    p.onboarding_status,
    p.agreement_id               as presentation_agreement_id,
    h.id                         as homeowner_id,
    h.slug                       as homeowner_slug,
    h.full_name,
    h.email,
    pr.id                        as property_id,
    pr.slug                      as property_slug,
    pr.address,
    m.id                         as membership_id,
    m.status                     as membership_status,
    m.payment_setup_completed_at,
    m.started_at,
    m.portal_access_token,
    m.agreement_id               as membership_agreement_id,
    m.sales_tier,
    m.visits_per_year,
    m.visit_price,
    m.stripe_customer_id,
    m.stripe_payment_method_id,
    coalesce(
      m.visits_per_year,
      case m.sales_tier
        when 'quarterly' then 4
        when 'biannual'  then 2
      end
    )                            as expected_obligation_count
  from presentations p
  join homeowners h  on h.id = p.homeowner_id
  join properties pr on pr.id = p.property_id
  left join memberships m on m.id = p.membership_id
  where p.id = '<PRESENTATION_ID>'
),
agreement as (
  select sa.*
  from ctx
  join signed_agreements sa
    on sa.id = coalesce(ctx.membership_agreement_id, ctx.presentation_agreement_id)
),
obligation_stats as (
  select
    o.membership_id,
    count(*)::int                                              as obligation_count,
    count(*) filter (where o.membership_year = 1)::int         as year1_count,
    count(*) filter (where o.status = 'promised')::int           as promised_count,
    count(*) filter (where o.memory_status <> 'none')::int       as memory_claimed_count
  from obligations o
  join ctx on ctx.membership_id = o.membership_id
  group by o.membership_id
),
obligation_events as (
  select count(*)::int as event_count
  from obligation_events oe
  join obligations o on o.id = oe.obligation_id
  join ctx on ctx.membership_id = o.membership_id
  where oe.to_status = 'promised'
    and oe.source = 'system'
)
select
  ctx.presentation_id,
  ctx.full_name,
  ctx.email,
  ctx.address,
  ctx.membership_id,

  -- 1) Membership active
  case
    when ctx.membership_status = 'active'
     and ctx.payment_setup_completed_at is not null
     and ctx.onboarding_status = 'complete'
    then 'PASS' else 'FAIL'
  end as check_membership_active,

  -- 2) Portal token exists (unguessable — not a slug)
  case
    when ctx.portal_access_token is not null
     and length(ctx.portal_access_token) >= 32
     and ctx.portal_access_token not in (ctx.homeowner_slug, ctx.property_slug)
    then 'PASS' else 'FAIL'
  end as check_portal_token,

  -- 3) Agreement stored & linked
  case
    when agreement.id is not null
     and agreement.status = 'complete'
     and agreement.agreement_pdf_url is not null
     and agreement.agreement_pdf_url not like 'data:%'
     and (
       agreement.agreement_pdf_url like 'storage:signed-agreements/%'
       or agreement.agreement_pdf_url like 'https://%'
     )
     and coalesce(ctx.membership_agreement_id, ctx.presentation_agreement_id) = agreement.id
    then 'PASS' else 'FAIL'
  end as check_agreement_stored,

  -- Optional: PDF object exists in private bucket
  case
    when agreement.agreement_pdf_url like 'storage:signed-agreements/%'
     and exists (
       select 1
       from storage.objects so
       where so.bucket_id = 'signed-agreements'
         and so.name = replace(agreement.agreement_pdf_url, 'storage:signed-agreements/', '')
     )
    then 'PASS'
    when agreement.agreement_pdf_url like 'https://%'
    then 'PASS'
    else 'FAIL'
  end as check_agreement_pdf_in_storage,

  -- 4) Obligations created (count matches tier cadence)
  case
    when ctx.expected_obligation_count is null then 'FAIL'
    when coalesce(os.obligation_count, 0) = ctx.expected_obligation_count
     and coalesce(os.year1_count, 0) = ctx.expected_obligation_count
     and coalesce(os.promised_count, 0) = ctx.expected_obligation_count
     and coalesce(oe.event_count, 0) >= ctx.expected_obligation_count
    then 'PASS' else 'FAIL'
  end as check_obligations_created,

  -- Detail columns (for debugging a FAIL)
  ctx.membership_status,
  ctx.payment_setup_completed_at,
  ctx.onboarding_status,
  left(ctx.portal_access_token, 8) || '…' as portal_token_prefix,
  agreement.id                             as agreement_id,
  agreement.status                           as agreement_status,
  agreement.agreement_pdf_url,
  ctx.sales_tier,
  ctx.visits_per_year,
  ctx.expected_obligation_count,
  coalesce(os.obligation_count, 0)         as obligation_count,
  coalesce(os.promised_count, 0)           as obligations_promised,
  coalesce(oe.event_count, 0)              as obligation_system_events

from ctx
left join agreement agreement on true
left join obligation_stats os on os.membership_id = ctx.membership_id
cross join obligation_events oe;
```

---

## 1. Membership verification

**Why it exists.** A signed agreement without an active membership means no card on file, no welcome email path, and no obligation generation. The member is not truly onboarded.

**What PASS means.** `check_membership_active = PASS`: `memberships.status = active`, `payment_setup_completed_at` is set, and `presentations.onboarding_status = complete`.

**What FAIL means.** Membership is still `pending_payment` or `inactive`, payment timestamp is null, or onboarding did not complete.

**If it fails.** Do not share the portal link. If the card was added in Stripe, recover via wargame 011 §Backups C (`POST /api/membership/setup-payment`). If not, send the payment-setup link and hold Jobber booking until Phase 4.1 passes.

**FAT-1 column:** `check_membership_active`

---

## 2. Agreement verification

**Why it exists.** The agreement PDF is chargeback evidence and the member's legal copy. A `data:` URL or missing storage object means email and portal download will fail.

**What PASS means.** `check_agreement_stored = PASS` and `check_agreement_pdf_in_storage = PASS`: one `signed_agreements` row with `status = complete`, PDF ref is `storage:signed-agreements/…` or HTTPS (never `data:`), linked to both presentation and membership, and the object exists in the private bucket when applicable.

**What FAIL means.** No agreement row, status not `complete`, PDF is a data URL, broken link, or agreement not wired to `memberships.agreement_id` / `presentations.agreement_id`.

**If it fails.** Do not re-run signing (creates duplicates). Use wargame 011 §Backups B — hand-deliver PDF from storage if possible. If link-update failed only, wargame 011 Q5 repairs `memberships.agreement_id`. ESCALATE before deleting any row.

**FAT-1 columns:** `check_agreement_stored`, `check_agreement_pdf_in_storage`

---

## 3. Portal verification

**Why it exists.** The portal token is the member's private front door. A missing or guessable token exposes the home record or breaks the welcome email.

**What PASS means.** `check_portal_token = PASS`: cryptographically random token (≥32 chars), not equal to homeowner or property slug. Visually confirm `/portal/[token]` loads the member's home (wargame 011 Phase 2.3–2.4).

**What FAIL means.** Token is null, too short, or equals a slug. Portal 404s or shows another member's data.

**If it fails.** Do not share the link. ESCALATE if token is missing. If portal loads but shows gate codes or access instructions, hold the link until fixed (wargame 011 Phase 2.4 — Operating Manual Part 1.3: separate audiences).

**FAT-1 column:** `check_portal_token`

**Also run FAT-3** (section 6) before sharing the link — portal must not show fabricated visits or savings.

---

## 4. Obligation verification

**Why it exists.** Obligations are the promise ledger — visits owed for year 1. Without them, HQ cannot track promised vs delivered (wargame 010 §8, Operating Manual promise #1).

**What PASS means.** `check_obligations_created = PASS`: row count in `obligations` equals `visits_per_year` (quarterly → 4, biannual → 2), all `membership_year = 1`, all `status = promised`, and system `obligation_events` logged.

**What FAIL means.** Zero obligations, wrong count, wrong status, or `visits_per_year` null on the membership.

**If it fails.** Confirm migration `018_obligations.sql` is applied. Re-hit `POST /api/membership/setup-payment` with the membership ID (idempotent — skips if obligations already exist). Log the member in the Obligation Register (wargame 011 Phase 3.4).

**FAT-1 column:** `check_obligations_created`

---

## 5. Duplicate detection

**Why it exists.** Double-submit creates twin agreements, twin memberships, or twin obligation rows — unrecoverable without manual surgery and a confused member.

**What PASS means.** **FAT-2 returns zero rows.**

**What FAIL means.** Any row returned — duplicate agreements, memberships, or obligations for this property.

**If it fails.** Stop. Do not delete blindly. Keep the earliest `complete` agreement. ESCALATE before any delete (wargame 011 Q3 recovery note).

### FAT-2 SQL

```sql
-- Customer #1 post-sign checklist — Query 2 (duplicates)
-- Replace <PRESENTATION_ID>

with ctx as (
  select
    m.id          as membership_id,
    pr.id         as property_id,
    pr.slug       as property_slug,
    h.slug        as homeowner_slug
  from presentations p
  join properties pr on pr.id = p.property_id
  join homeowners h  on h.id = p.homeowner_id
  left join memberships m on m.id = p.membership_id
  where p.id = '<PRESENTATION_ID>'
)

-- 5) No duplicate agreements (any of these returning rows = FAIL)
select
  'duplicate_agreements_by_property_slug' as failure,
  sa.property_slug,
  count(*) as row_count
from signed_agreements sa
join ctx on sa.property_slug = ctx.property_slug
group by sa.property_slug
having count(*) > 1

union all

select
  'duplicate_agreements_by_property_id' as failure,
  sa.property_id::text,
  count(*) as row_count
from signed_agreements sa
join ctx on sa.property_id = ctx.property_id
group by sa.property_id
having count(*) > 1

union all

select
  'duplicate_agreements_complete_per_property' as failure,
  sa.property_id::text,
  count(*) as row_count
from signed_agreements sa
join ctx on sa.property_id = ctx.property_id
where sa.status = 'complete'
group by sa.property_id
having count(*) > 1

union all

select
  'duplicate_memberships_per_property' as failure,
  m.property_id::text,
  count(*) as row_count
from memberships m
join ctx on m.property_id = ctx.property_id
group by m.property_id
having count(*) > 1

-- 6) No duplicate obligations
union all

select
  'duplicate_obligations_same_sequence' as failure,
  o.membership_id::text || ' year ' || o.membership_year::text || ' seq ' || o.sequence::text,
  count(*) as row_count
from obligations o
join ctx on o.membership_id = ctx.membership_id
group by o.membership_id, o.membership_year, o.sequence
having count(*) > 1

union all

select
  'duplicate_obligation_windows' as failure,
  o.membership_id::text || ' ' || o.target_window_start::text || '..' || o.target_window_end::text,
  count(*) as row_count
from obligations o
join ctx on o.membership_id = ctx.membership_id
group by o.membership_id, o.target_window_start, o.target_window_end
having count(*) > 1;
```

---

## 6. Data integrity

**Why it exists.** The portal reads `member_appointments`, `member_savings_transactions`, `member_profiles`, `service_observations`, `property_visit_health_checks`, and `home_care_plans.presentation` JSON. Demo seed data or invented visits/savings violate Operating Manual Part 1.3 — *no fake data*.

**What PASS means.** **FAT-3:** every `portal_*` column = `PASS`. Before the first real visit: zero appointments, zero savings, zero observations, empty `last_visit`, empty plan findings.

**What FAIL means.** Any completed appointment, savings transaction, non-zero `total_saved_cents`, health check, visit-linked photo, or non-empty fabricated fields in the stored plan JSON.

**If it fails.** Identify the source (demo seed, wrong homeowner, manual test data). Delete only rows scoped to this `property_id` / `homeowner_id` after confirming IDs. Re-run FAT-3. Do not share the portal until clean.

**Note:** If no `member_profiles` row exists yet, visit/savings counts stay zero — correct for a brand-new member.

### FAT-3 SQL

```sql
-- Customer #1 post-sign checklist — Query 3 (portal data purity)
-- Replace <PRESENTATION_ID>

with ctx as (
  select
    h.id   as homeowner_id,
    pr.id  as property_id,
    m.id   as membership_id
  from presentations p
  join homeowners h  on h.id = p.homeowner_id
  join properties pr on pr.id = p.property_id
  left join memberships m on m.id = p.membership_id
  where p.id = '<PRESENTATION_ID>'
),
profile as (
  select mp.*
  from member_profiles mp
  join ctx on mp.homeowner_id = ctx.homeowner_id
),
counts as (
  select
    (select count(*) from member_appointments ma
      join profile p on p.id = ma.member_profile_id
      join ctx on ma.property_id = ctx.property_id)                          as appointment_rows,

    (select count(*) from member_appointments ma
      join profile p on p.id = ma.member_profile_id
      join ctx on ma.property_id = ctx.property_id
      where ma.status = 'completed')                                         as completed_appointments,

    (select count(*) from member_savings_transactions mst
      join profile p on p.id = mst.member_profile_id)                        as savings_rows,

    coalesce((select p.total_saved_cents from profile p limit 1), 0)         as profile_saved_cents,

    (select count(*) from service_observations so
      join ctx on so.property_id = ctx.property_id)                          as observation_rows,

    (select count(*) from property_visit_health_checks h
      join ctx on h.property_id = ctx.property_id)                           as health_check_rows,

    (select count(*) from property_assets pa
      join ctx on pa.property_id = ctx.property_id
      where pa.visit_id is not null)                                          as visit_linked_assets,

    (select coalesce(nullif(trim(pr.last_visit), ''), 'EMPTY')
      from properties pr join ctx on pr.id = ctx.property_id)                as property_last_visit,

    (select coalesce(jsonb_array_length(hcp.presentation->'findings'), 0)
      from home_care_plans hcp
      join ctx on hcp.property_id = ctx.property_id)                          as plan_findings_count,

    (select coalesce(hcp.presentation->'property'->>'lastVisit', '')
      from home_care_plans hcp
      join ctx on hcp.property_id = ctx.property_id)                          as plan_last_visit
)
select
  -- 7) No fake visits/savings — portal should show empty state
  case when appointment_rows = 0           then 'PASS' else 'FAIL' end as portal_no_appointments,
  case when completed_appointments = 0     then 'PASS' else 'FAIL' end as portal_no_completed_visits,
  case when savings_rows = 0               then 'PASS' else 'FAIL' end as portal_no_savings_transactions,
  case when profile_saved_cents = 0          then 'PASS' else 'FAIL' end as portal_no_profile_savings,
  case when observation_rows = 0           then 'PASS' else 'FAIL' end as portal_no_observations,
  case when health_check_rows = 0          then 'PASS' else 'FAIL' end as portal_no_health_checks,
  case when visit_linked_assets = 0        then 'PASS' else 'FAIL' end as portal_no_visit_photos,
  case when property_last_visit = 'EMPTY'  then 'PASS' else 'FAIL' end as portal_no_property_last_visit,
  case when plan_findings_count = 0        then 'PASS' else 'FAIL' end as portal_no_plan_findings,
  case when coalesce(plan_last_visit, '') = '' then 'PASS' else 'FAIL' end as portal_no_plan_last_visit,

  -- Raw counts (debug)
  appointment_rows,
  completed_appointments,
  savings_rows,
  profile_saved_cents,
  observation_rows,
  health_check_rows,
  visit_linked_assets,
  property_last_visit,
  plan_findings_count,
  plan_last_visit

from counts;
```

---

## One-line gate (post-sign)

```
FAT-1: all check_* = PASS
FAT-2: zero rows
FAT-3: all portal_* = PASS
```

Then open `/portal/[token]` and confirm visually: *"We're scheduling your first visit,"* empty timeline, no savings badge.

---

## Before Customer #2

Do not sell Customer #2 until Customer #1 passes the gate above **and** these standing items are true.

| # | Item | Tool | Pass |
|---|------|------|------|
| A1 | Customer #1 FAT complete | FAT-1 / FAT-2 / FAT-3 | All PASS on first attempt for Customer #1's `<PRESENTATION_ID>` |
| A2 | Member has their PDF | Customer phone + Resend log | Agreement email received; PDF opens |
| A3 | Stripe clean | Stripe dashboard | One customer, one payment method, **zero charges** on sign day |
| A4 | Price consistency | Slide + agreement + FAT-1 detail columns | Same tier and visit price everywhere |
| A5 | Billing Register | wargame 010 §3 | Customer #1 logged with service month, `visit_price`, `stripe_customer_id` |
| A6 | Obligation Register | wargame 010 §8 | Customer #1 promises logged; FAT-1 `obligation_count` matches tier |
| A7 | Founding member (if launch cohort) | wargame 011 Q4 | `founding_member` set — cannot be granted honestly later |
| A8 | Dry-run artifacts removed | wargame 011 Q-cleanup | No test homeowners polluting production |
| A9 | First visit scheduled | Jobber + wargame 011 Phase 4 | Client booked within 2 business days; address matches `properties.address` |
| A10 | Lessons captured | HQ / ops notes | Any YELLOW backup used during Customer #1 is documented with owner |

**Launch decision (wargame 011):** Customer #1 is real, correct, and provable when the gate and A1–A6 are true. Then — and only then — Customer #2.

---

*Canonical acceptance SQL for SqueegeeOS / HomeAtlas. Schema reference: `lib/persistence/supabase/schema.sql` + migrations through `018_obligations.sql`. Update this document when migrations change query assumptions — not the application.*
