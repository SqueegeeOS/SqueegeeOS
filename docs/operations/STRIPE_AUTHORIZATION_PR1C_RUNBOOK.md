# PR1c Stripe setup authorization runbook

**Status:** Database and runtime halves implemented in the
`codex/jobber-j1-release` worktree; not committed, merged, migrated, deployed,
disposable-database proven, or production-proven.

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
- Activation appends immutable provider/linkage and locked-term evidence.
  Migration 042 additionally creates exactly the year-one obligations, one
  immutable activation event per obligation, and one immutable website sale
  before publishing membership `active` or presentation onboarding `complete`.
  Exact retries prove the complete durable set without requiring obligations to
  remain `promised`, so legitimate later status transitions replay. Partial or
  mismatched completion is held. Any insert failure aborts the RPC transaction.
- The activation handler requires the RPC result to include the durable sale
  UUID and an obligation count exactly matching the locked two- or four-visit
  cadence before portal lookup, success response, or welcome email. It performs
  no post-RPC obligation or sale writes; replay never sends another welcome.
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

## Migration 042

`042_atomic_membership_activation_completion.sql` is an additive, idempotent
replacement of only `activate_membership_after_stripe_setup`. It preserves the
migration 037 signature, lock order, identity/pricing/provider checks, immutable
payment evidence, fixed `pg_catalog` search path, and service-role-only ACL. It
adds a unique immutable activation-event proof and makes website sales
append-only with service-role read-only access. No new table or pricing source is
introduced. `annualized_value` is only the reporting derivation of the locked
`visit_price × visits_per_year` captured by migration 037.

The disposable rehearsal is
`lib/persistence/supabase/tests/042_atomic_membership_activation_completion.sql`.
Its opt-in Vitest wrapper requires both
`PR1C_DISPOSABLE_DB_ACK=I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE` and
`PR1C_TEST_DATABASE_URL`. It covers forced sale-insert rollback, partial and
mismatched state, exact and queued concurrent replay, a legitimate obligation
status transition, UTC month-end parity, ACLs, and immutable evidence.

## Release gates

All gates remain open until recorded against disposable/test resources:

1. Review and rehearse migrations 036, 037, then 042 on a disposable Supabase project.
   The rehearsal must include a malformed partial-schema rejection and an exact
   audit of columns/types/nullability/defaults, primary keys, all FK/unique/check
   constraints, function signatures/security/ACL/search paths, migration 037's
   three immutable triggers, migration 042's partial unique index, both
   completion immutability triggers, and the website-sale ACL.
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

Migration 042 is also additive and must not be reversed by deleting obligations,
activation events, sales, or payment evidence. Before release, rollback is
removal of the uncommitted 042 diff. After release, first deploy a fail-closed
payment route, preserve all ledgers, and replace the RPC only through a new
reviewed migration. Do not restore post-activation helper writes.

## Local verification — July 18, 2026

- Focused Vitest: 6 files and 47 tests passed; the 2 credential-gated
  integration files and their 10 tests skipped without an acknowledged
  disposable database URL.
- Runtime route Vitest: 1 file and 24 tests passed, including malformed or
  missing durable completion evidence, complete activation, and exact replay.
- Full Vitest: 112 files passed and 5 credential-gated files skipped; 672 tests
  passed and 14 skipped.
- Migration audit JavaScript syntax and focused ESLint checks pass.
- The read-only database migration audit stopped before opening a connection
  because neither `SUPABASE_DB_URL` nor `DATABASE_URL` is configured locally.
- Migration/rehearsal dollar-quote balance, forbidden pricing-write scan, and
  `git diff --check` pass.
- `tsc --noEmit` still reports only the documented unrelated fixture errors;
  no migration-042 file appears in the diagnostics.

## Current unresolved evidence

- Production migration state is unknown; migrations 036, 037, and 042 are not proven applied.
- Disposable Supabase concurrency/RPC ACL rehearsal is not yet recorded.
- Stripe test-mode end-to-end evidence is not yet recorded.
- Merge, migration, deployment, production access, money movement, and customer
  communication remain outside this implementation authority.
