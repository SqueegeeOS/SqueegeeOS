# Complete & Charge Visit

**Status:** First implementation slice
**Surface:** Headquarters → Billing
**Purpose:** Turn a scheduled membership appointment into a completed property record, an itemized Stripe invoice, a payment result, and truthful member savings.

## Founder workflow

1. Open the member in Headquarters Billing.
2. Choose **Complete & charge** on a scheduled appointment.
3. Confirm the service date.
4. Review each service's retail value, charged amount, and savings.
5. Add completed add-ons when needed.
6. Review the combined charge.
7. Confirm the final saved-card charge.

The first confirmation is review-only. The second confirmation performs the operation.

## Transaction guarantees

- Operation identity is `membership + appointment`.
- Stripe invoice creation, line creation, finalization, and payment each use stable idempotency keys.
- A retry reuses the stored Stripe invoice instead of creating a new one.
- A paid billing period returns `already_paid` and never charges again.
- Completed services and savings remain truthful when a card declines.
- A decline writes `failed` with `$0` collected; it never appears as paid.
- A Stripe-paid/database-failed operation can be retried: HomeAtlas retrieves the existing paid invoice and repairs the ledger without charging again.

## Current boundaries

- Requires an active membership, stored Stripe customer, stored payment method, and scheduled `member_appointments` row.
- Uses the existing monthly membership billing row, so V1 assumes at most one membership visit per member per service month.
- Customer receipts still depend on Stripe account email settings. Receipt delivery must become an explicit verified outcome before unattended charging.
- Decline recovery and update-card links remain founder-assisted.
- Webhook reconciliation remains required before automatic background charging.

## Sylvia reference case

| Service | Retail | Charged | Savings |
|---|---:|---:|---:|
| Window cleaning | $400 | $300 | $100 |
| Roof treatment | $375 | $300 | $75 |
| **Total** | **$775** | **$600** | **$175** |

This case is covered by `lib/admin/complete-charge-visit-shared.test.ts`.
