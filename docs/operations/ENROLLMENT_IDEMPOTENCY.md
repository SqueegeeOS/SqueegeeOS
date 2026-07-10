# Enrollment idempotency and partial-failure recovery

**Status:** Slice 3 — operational reference  
**Related:** `MEMBERSHIP_SOURCE_OF_TRUTH.md`, Sylvia audit (`membership_enrollment_savings` null)

---

## Happy path

```
Sign agreement → membership pending_payment + signed_agreements row
     → Stripe SetupIntent succeeds
     → POST /api/membership/setup-payment
     → memberships.status=active + payment_setup_completed_at
     → obligations + website_membership_sales + enrollment_savings (best-effort)
```

---

## Idempotency keys / unique constraints

| Resource | Constraint / key | Behavior on retry |
|----------|------------------|-------------------|
| Membership per property | `memberships.unique(property_id)` | Upsert on `property_id` in `completeSignOnboarding` |
| Homeowner | `homeowners.slug` unique | Upsert on slug |
| Property | `unique(homeowner_id, slug)` | Upsert |
| Website sale | `website_membership_sales.unique(membership_id)` | Insert; `23505` → `already_recorded` |
| Obligations | Count by `membership_id` + `membership_year` | Skip if any exist (`already_generated`) |
| Enrollment savings | Update only when column `IS NULL` | Second call is no-op |
| Payment activation | Update only when `payment_setup_completed_at IS NULL` | Concurrent retries: one writer wins; loser reloads + recovers side effects |
| Sign onboarding | Presentation `status=signed` + `membership_id` + `agreement_id` | Short-circuit; no second PDF |
| Agreement by presentation | Reuse complete `signed_agreements` for `presentation_id` | Avoids duplicate agreement rows on partial retry |

---

## When Stripe succeeds but the DB step fails

1. **SetupIntent already `succeeded`** — card is attached to the Stripe customer.
2. **Membership row** may still be `pending_payment` with `payment_setup_completed_at = null`.
3. **Safe recovery:** Retry `POST /api/membership/setup-payment` with the same `setupIntentId` + `paymentMethodId` (or `membershipId`).
   - Endpoint re-verifies the SetupIntent.
   - Conditional update sets `active` + `payment_setup_completed_at` if still null.
   - Side effects (obligations, website sale, enrollment savings) are idempotent.
4. **Do not** create a second SetupIntent for the same membership unless the first was cancelled/failed.
5. **Admin:** Re-calling setup-payment (or the already-active recovery branch) is safe; it will not double-charge (SetupIntent is not a charge).

If the DB update returns 500, the JSON body includes a `recovery` hint and `membershipId`.

---

## Partial failure matrix

| Failed step | Member-visible state | Safe retry |
|-------------|----------------------|------------|
| PDF/storage after membership upsert | `pending_payment`, no agreement | Re-sign / re-call sign-agreement (membership upserted; agreement insert may create PDF) |
| Agreement insert | Membership exists, no `agreement_id` | Retry sign — reuses membership; inserts agreement if missing |
| Presentation link update | Membership + agreement OK; presentation may still show draft | Retry sign or admin fix presentation links |
| Stripe OK, membership update fails | Card on Stripe; membership not active | Retry setup-payment |
| Membership active, obligations fail | Active member, no visit windows | Retry setup-payment (`alreadyActive` regenerates obligations) |
| Membership active, website sale fails | Active; HQ sale ledger missing | Retry setup-payment (unique on membership_id) |
| Membership active, enrollment savings fail | Active; savings null (Sylvia case) | Retry setup-payment locks savings if still null |
| Welcome email fails | Active; no email | Resend welcome separately — not blocking |

---

## What admin can safely retry

- `POST /api/membership/setup-payment` for a known membership / presentation (idempotent activation + side effects).
- Sign-agreement for an already-signed presentation (returns existing membership/agreement).
- Manual obligation ensure / website sale record via existing admin services (unique-guarded).

## What is still unsafe

- Manually editing Sylvia’s production rows without founder approval.
- Creating a second membership for the same property (blocked by unique constraint — do not force-delete).
- Applying migration 029 in this pass.
- Charging the card outside the billing workspace (SetupIntent is card-on-file only).
