# Membership source of truth

**Status:** Canonical reference for HomeAtlas stabilization (Slice 1).  
**Resolver:** `lib/membership/membership-lifecycle-resolver.ts`

Every HQ, portal, scheduling, billing, and enrollment surface must derive membership state from the shared resolver — never re-derive inline.

---

## Record ownership map

| Concern | Owner record | Column / field | Notes |
|--------|--------------|----------------|-------|
| Selected tier | `memberships` | `sales_tier` (`biannual` \| `quarterly`) | Set at sign completion from presentation tier |
| Agreed visit price | `memberships` | `visit_price` | Locked at sign; also on `signed_agreements` snapshot |
| Membership DB status | `memberships` | `status` | `inactive`, `pending_payment`, `active`, `paused`, `cancelled` |
| Stripe customer | `memberships` | `stripe_customer_id` | Created during payment setup |
| Payment method | `memberships` | `stripe_payment_method_id` | Attached during setup |
| Payment completion | `memberships` | `payment_setup_completed_at` | Set in same write as `status: active` (`setup-payment`) |
| Signed agreement | `signed_agreements` | `status`, `plan_name`, `signed_at` | `complete` when PDF stored |
| Agreement link | `memberships` | `agreement_id` | FK to `signed_agreements` |
| Presentation tier/price | `presentations` | `tier`, quote snapshot | Pre-sign source; must match membership after sign |
| Scheduled visits | `member_appointments` | `property_id`, `scheduled_at`, `status` | One row per visit; property-scoped |
| Portal display | Server loader | `getMemberPortalDataBySlugs` | Reads membership + appointments + add-ons via privileged client |
| HQ memberships table | `GET /api/admin/memberships` | `resolveHqMembershipDisplayStatus` | Maps lifecycle → operational row status |
| HQ revenue (overview) | `loadMembershipProductionRevenueOverview` | `memberships` + `signed_agreements` | Active = strict `isMembershipActive`; signed today from agreements |
| Billing register | `loadBillingWorkspace` | `memberships` + obligations + charges | Uses `isMembershipActive` for billable rows |
| Referral eligibility | `referrals/repository` | `memberships.id` | Code tied to membership; rewards after conversion |
| Savings ledger | `member_savings_ledger_entries` | `membership_id` | Visit + add-on savings lines |

---

## Normalized lifecycle states

Returned by `resolveMembershipLifecycle()`:

| State | Meaning |
|-------|---------|
| `draft` | Property/presentation exists; no completed sign path |
| `agreement_pending` | Presentation unsigned or agreement incomplete |
| `payment_pending` | Agreement signed; no payment signal |
| `activation_pending` | Payment signal present; membership not yet `active` + completed setup |
| `active` | Signed, tier/price set, payment completed, status `active` |
| `past_due` | Active member with billing past due (when `pastDue` input supplied) |
| `paused` | DB status `paused` |
| `canceled` | DB status `cancelled` |
| `inconsistent` | Conflicting signals (e.g. active without payment completion, tier mismatch) |

---

## Active membership requirements (strict)

A membership is **active** only when **all** are true:

1. `memberships.status === 'active'`
2. `memberships.payment_setup_completed_at` is set
3. `memberships.agreement_id` references a completed agreement (when agreement expected)
4. `memberships.sales_tier` and `visit_price` are present
5. Not `cancelled` or `paused`

Scheduling and billing gates use the same strict definition via `isMembershipActive()`.

HQ display adds operational nuance **on top of** lifecycle (`scheduled` vs `needs scheduling`) using the next `member_appointments` row — not a different definition of active.

---

## Surfaces using the resolver

| Surface | Entry point |
|---------|-------------|
| HQ overview | `build-dashboard.ts` → `isMembershipActive` |
| HQ memberships | `app/api/admin/memberships/route.ts` → `resolveHqMembershipDisplayStatus` |
| Command center | `membership-command-center-server.ts` → `resolvePendingMemberReason`, `isMembershipPendingEnrollment` |
| Billing workspace | `billing-workspace-server.ts` |
| Customer workspace | `load-workspace.ts` → `resolveMembershipLifecycle`, `isMembershipPendingEnrollment` |
| Portal profile | `member-portal.ts` → `resolvePortalMembershipStatus` |
| Portal payment UI | `portal-payment-state.ts` → lifecycle-based `pendingPayment` |
| Setup payment (idempotent) | `app/api/membership/setup-payment/route.ts` → `isMembershipActive` |
| Scheduling | `schedule-membership-service.ts` → `canScheduleMembership`, `isMembershipCancelled` |
| Add-on recording | `record-member-addon-service.ts` → `isMembershipCancelled` |
| Manual billing | `record-manual-billing-charge.ts` → `canBillMembership` |
| Onboarding status API | `app/api/membership/onboarding-status/route.ts` |
| Production revenue | `membership-production-revenue-server.ts` |

---

## Intentionally not migrated in Slice 1

- **Migration 029** (`portal_theme`) — pending; see `MIGRATION_029_PENDING.md`
- **Raw Stripe webhooks** — audited in Slice 4
- **HQ metric labels** (contracted vs collected) — Slice 4
- **HQ revenue `activeMembershipValue`** — still uses `hasPaymentMethodOnFile` not strict `isMembershipActive`; Slice 4
- **Presentation UI** (`presentation-editor`, `presentation-viewer`) — presentation status, not membership DB status
- **`archive-membership.ts`** — operational archive guard on raw `cancelled` status
