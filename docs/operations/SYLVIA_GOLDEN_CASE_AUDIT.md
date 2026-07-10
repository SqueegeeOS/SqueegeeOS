# Sylvia Siegel — golden-case audit (read-only)

**Date:** 2026-07-09  
**Scope:** Slice 2 — document inconsistencies only; no production writes.  
**Script:** `node scripts/audit-sylvia-golden-case.mjs`  
**IDs:** Membership `cdd45fa1-8728-41b1-aa7c-1f34ae97ccc4` · Property `5c8ab9f1-4145-4427-840d-c11a0faecafa` · Homeowner `1364b89e-f4de-4120-b43f-78f15057329c`

---

## Audit method

| Layer | Access | What was checked |
|-------|--------|------------------|
| Supabase (anon) | `.env.local` anon key | `memberships`, `homeowners`, `properties`, `signed_agreements` |
| Supabase (protected) | Requires `SUPABASE_SERVICE_ROLE_KEY` | `member_appointments`, `member_addon_transactions`, `presentations` (RLS 030) |
| Production portal | Not token-authenticated in this pass | Slug demo route `/homecare/sylvia-siegel/366-brookside-drive/portal` returns 200 |

Re-run with service role for full appointment/add-on cross-check:

```bash
node scripts/audit-sylvia-golden-case.mjs
```

---

## PASS — core membership spine

| Check | Value |
|-------|-------|
| `memberships.status` | `active` |
| `payment_setup_completed_at` | set (2026-07-09) |
| `stripe_customer_id` / `stripe_payment_method_id` | set (redacted in script output) |
| `agreement_id` | `acd977dc-ec3a-4d77-848b-92a15b700107` |
| `sales_tier` | `biannual` |
| `visit_price` | **300** (not 450 — test fixtures are stale) |
| `visits_per_year` | 2 |
| `annual_rate` | 600 |
| Strict `isMembershipActive()` | **true** |
| `signed_agreements.status` | `complete` |
| Agreement `plan_name` | matches bi-annual membership |
| Agreement `membership_id` | matches membership row |
| Homeowner slug | `sylvia-siegel` |
| Property slug | `366-brookside-drive` (not `chico-estate` in test mocks) |

---

## Documented inconsistencies / gaps

### 1. `membership_enrollment_savings` is null

- **Expected:** Locked at payment activation via `persistMembershipEnrollmentSavings` in `setup-payment`.
- **Actual:** `null` on membership row.
- **Impact:** Portal savings ledger may omit enrollment savings line; HQ yearly value still uses `visit_price`.
- **Action:** Slice 3 — verify idempotent re-run of enrollment savings lock; **no manual DB write without approval**.

### 2. Property `city` is `TBD`

- **Expected:** Real city for member communications and HQ address display.
- **Actual:** `properties.city = "TBD"`.
- **Impact:** Cosmetic / correspondence; not a membership lifecycle bug.
- **Action:** HQ data cleanup when approved (not in this pass).

### 3. Protected tables not visible via anon key

- **Expected:** At least one future `member_appointments` row and moss add-on per wargame notes.
- **Actual:** Empty arrays via anon (RLS 030 — not a data deletion signal).
- **Impact:** This audit pass cannot confirm portal schedule or add-on revenue without service role or live portal token session.
- **Action:** Re-run script with `SUPABASE_SERVICE_ROLE_KEY` or verify via authenticated `/portal/[token]` on production.

### 4. `presentations` row not readable via anon

- **Expected:** Presentation `09aa75eb-fb37-46a0-b831-2169a42c4b13` signed with tier `biannual`.
- **Actual:** `null` via anon select by id.
- **Impact:** Cannot cross-check presentation tier vs membership without service role.
- **Mitigation:** Agreement and membership tiers already agree on bi-annual / $300.

### 5. Test/fixture drift (not production bugs)

| Fixture | Production |
|---------|------------|
| Property slug `chico-estate` | `366-brookside-drive` |
| `visit_price` 450 | 300 |
| Mock portal tests | Update when convenient — does not block Sylvia |

### 6. Demo slug route still live

- `/homecare/sylvia-siegel/chico-estate/portal` returns HTTP 200 on production.
- Canonical property slug is `366-brookside-drive`; stale slug may show wrong or fallback demo data.
- **Action:** Confirm demo route behavior; do not remove without product decision.

---

## HQ / portal surface alignment (code-level)

| Surface | Resolver used? | Sylvia expectation |
|---------|----------------|-------------------|
| HQ memberships API | `resolveHqMembershipDisplayStatus` | Should show **active** or **scheduled** if appointment exists |
| Portal profile status | `resolvePortalMembershipStatus` | **active** (strict fields satisfied) |
| Command center | `isMembershipActive` + pending helpers | Active member bucket |
| Revenue overview | `hasPaymentMethodOnFile` for card-on-file value | Counts Sylvia in card-on-file / on-book (Slice 4 may tighten to strict active) |

---

## Approval required before any production fix

Per stabilization plan: fix only with documented discrepancy, expected value, rollback note, and explicit founder OK.

| Issue | Safe to auto-fix? |
|-------|-----------------|
| enrollment_savings null | No — run idempotent `setup-payment` recovery path (Slice 3) |
| city TBD | No — manual HQ edit |
| appointments/add-ons unverified | No — verify with service role first |

---

## Next audit step

1. Add `SUPABASE_SERVICE_ROLE_KEY` to local `.env.local` and re-run script.
2. Open production `/portal/[token]` and confirm next visit + moss add-on render.
3. Compare HQ memberships row for Sylvia against script output.
