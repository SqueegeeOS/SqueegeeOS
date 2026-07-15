# PR1c Stripe setup authorization runbook

**Status:** Implemented on `codex/jobber-j1-stripe-authorization`; not committed,
merged, migrated, deployed, or production-proven.

## Outcome and boundary

PR1c closes the public presentation/payment authorization bypass without
charging a card or changing pricing, agreements, Jobber, or membership policy.

- Public setup accepts exactly one existing opaque presentation UUID or portal
  token. A membership UUID is never request authority.
- Supabase service-role reads resolve homeowner, property, presentation,
  agreement, membership, and Stripe linkage. Browser name, email, customer ID,
  payment method ID, lifecycle state, metadata, and timestamps are rejected.
- Stripe must be fully configured in one test/live mode. Missing or mismatched
  keys return `503`; there is no mock success or authoritative write.
- One membership-bound Stripe customer and one SetupIntent are claimed for the
  exact signed, pending membership. Existing Stripe customers must already have
  the complete binding metadata; missing metadata is held for reconciliation.
- Before any Stripe Customer or SetupIntent creation, a locked service-only RPC
  writes the immutable capability-resolved membership/presentation/property,
  signed Atlas terms and authority hash, deterministic Customer/SetupIntent
  idempotency keys, and `before_provider/reserved` state. Provider IDs and each
  later outcome/error are append-only events, so a process failure leaves a
  deterministic reconciliation trail instead of an orphan with no HomeAtlas
  provenance.
- Activation retrieves Stripe truth, requires a succeeded SetupIntent and a
  payment method attached to the expected customer, then calls the migration
  037 transaction. The transaction locks and rechecks every HomeAtlas link,
  signing attempt, selected tier, per-visit price, visit cadence, and the signed
  presentation's Atlas quote-authority hash.
- Activation appends immutable provider/linkage and locked-term evidence. Exact
  retries require that evidence and return its original completion time and
  authoritative activation snapshot. Other active, paused, cancelled, stale,
  conflicting, cross-customer, or changed-term attempts are held with no
  obligations, sale, enrollment lock, or presentation completion.
- The activation handler performs no Stripe write after SetupIntent creation;
  it only retrieves provider truth. In particular, it does not change customer
  invoice defaults. The succeeded SetupIntent attachment is card-on-file truth.
- This flow stores a card for future use; it does not create a PaymentIntent,
  invoice, charge, refund, credit, or subscription.

## Migration 037

`037_stripe_setup_authorization.sql` is additive and idempotent. It adds the
nullable `memberships.stripe_setup_intent_id`, unique partial indexes for the
membership-bound Stripe customer and SetupIntent, an RLS-enabled append-only
`membership_payment_setup_events` evidence table, and two service-role-only
reconciliation tables. It exposes four service-role-only transaction functions:

- `reserve_membership_stripe_setup_reconciliation`
- `append_membership_stripe_setup_reconciliation_event`
- `claim_membership_stripe_setup`
- `activate_membership_after_stripe_setup`

The migration refuses to create the customer uniqueness index if duplicate
legacy bindings exist; those rows must remain held for human reconciliation.
The claim function uses `security invoker`; reservation, append, and activation
are hardened `security definer` transactions so the evidence tables can deny
direct writes. Every function uses an explicit `pg_catalog` search path and
locked exact-state checks. Browser roles receive no RPC or evidence-table
authority. Migration 037 must follow 036 and must not be applied by the app.

## Release gates

All gates remain open until recorded against disposable/test resources:

1. Review and rehearse migrations 036 then 037 on a disposable Supabase project.
   The rehearsal must include a malformed partial-schema rejection and an exact
   audit of columns/types/nullability/defaults, primary keys, all FK/unique/check
   constraints, function signatures/security/ACL/search paths, and all three
   immutable triggers.
2. Prove anon/authenticated cannot execute any PR1c function and service role
   can only converge the exact pending membership.
3. Run two concurrent setup and activation requests, including two memberships
   genuinely queued at the same advisory-lock barrier while racing for one
   customer and SetupIntent. Prove exactly one binding wins and the loser has no
   activation, evidence, obligation, or sale.
4. Race a locked membership price/tier/linkage change against activation and
   prove the RPC returns held with no activation evidence, obligations, sale,
   enrollment lock, presentation completion, or post-SetupIntent Stripe write.
5. Run Stripe test-mode cases for missing capability, stale capability, wrong
   customer, wrong metadata, unattached payment method, unsuccessful/cancelled
   intent, exact replay, and happy path.
6. Verify no PaymentIntent, charge, invoice, subscription, customer invoice
   default mutation, or real customer
   communication was created. Use only an approved non-customer test recipient.
7. Run focused tests, full `npm test`, `npx tsc --noEmit`, `npm run lint`,
   `npm run build`, `git diff --check`, and the read-only migration audit.
8. Obtain independent Reliability Guardian approval, then separate founder
   approval for migration, merge, and deployment actions.

## Post-deploy verification

Using a fresh test presentation, verify the signed agreement and all Supabase
links first. Complete card setup once, retrieve the SetupIntent and PaymentMethod
from Stripe, and compare every metadata/customer ID with Supabase and the
`membership_payment_setup_events` row. Confirm one active membership, one
immutable evidence row/completion timestamp, one website sale, and the expected
obligations. Replay the same activation and verify no duplicate state. Exercise
one wrong-capability request and verify no write. This is test evidence only; do
not charge or message a real customer.

For reconciliation, compare the evidence row's membership, presentation,
agreement, homeowner, property, customer, SetupIntent, PaymentMethod, mode,
status, metadata, locked tier/price/visit terms, Atlas authority hash, and
completion time against the immutable reconciliation attempt and append-only
provider event sequence, current Supabase linkage, and a
fresh Stripe test/live API retrieval. Any missing or non-exact value keeps the
membership held; record the discrepancy through the existing supervised
operations process. Do not repair provider IDs or activation history in place.

## Rollback

Before migration/deployment, rollback is deletion of the PR1c working-tree diff.
After release, never roll back to PR1b's permissive payment handlers. First put
both payment routes into a fail-closed `503` holding deployment, then investigate.
Migration 037 is additive and may remain dormant. Preserve the evidence table
and both Stripe-binding columns. Do not clear provider IDs, delete evidence, or
rewrite activation history. Function replacement or schema removal requires a
separately reviewed maintenance migration after proving no retained evidence or
active flow depends on it.

## Current unresolved evidence

- Production migration state is unknown; neither 036 nor 037 has been applied.
- Disposable Supabase concurrency/RPC ACL rehearsal is not yet recorded.
- Stripe test-mode end-to-end evidence is not yet recorded.
- Merge, migration, deployment, production access, money movement, and customer
  communication remain outside this implementation authority.
