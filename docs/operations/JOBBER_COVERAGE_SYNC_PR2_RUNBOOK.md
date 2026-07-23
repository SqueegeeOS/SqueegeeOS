# Jobber coverage sync — PR2 runbook

**Status:** Repository implementation only; migration 038 is not applied
**Scope:** Manual, read-only Jobber schedule observation in Headquarters
**Authority:** Jobber remains appointment and dispatch truth
**Non-goals:** Matching, classification, cancellation inference, HomeAtlas scheduling, obligations, pricing, billing, Stripe, agreements, membership state, Property Memory, Today, or the member portal

## What PR2 proves

An authorized Headquarters actor can manually read a fixed Pacific schedule
window from 90 calendar days back through the full day 365 calendar days
forward. The sync recursively partitions fixed half-open `startAt` windows and
requests `first: 50` for each partition. It never follows a Relay cursor.

A leaf is complete only when Jobber reports `hasNextPage=false`. An overflowing
leaf is split into exact adjacent half-open windows. The run stops partial if a
leaf still overflows at one millisecond, the 14-request run cap is reached, or
any provider, timestamp, version, timeout, storage, lock, comparison, or
deterministic finalization check fails. A transport-ambiguous finalization uses
the separate indeterminate behavior below.

The same fixed bounds are read twice. Finalization requires identical canonical
`visit ID + source hash` manifests and identical leaf coverage. Migration 038
then independently compares the durable pass observations and leaf rows in one
transaction before it:

1. updates only `jobber_visit_projections` from the stable second pass;
2. rejects an observation older than the projection already stored;
3. compare-and-sets the connection coverage watermark;
4. marks the run complete and releases its durable lock.

The durable lock order is part of the PR2/PR3 contract. PR2 begin locks the
exact connection's `jobber_schedule_sync_locks` row before reading the watermark
generation and reserving a run. Finalization locks its run row, then that exact
sync row, then the watermark. Migration 039 decisions lock the same sync row
before any projection/link/membership/watermark authority rows and never lock a
run row. This compatible partial order prevents a reverse run/sync edge: a
decision either linearizes before reservation against stable complete coverage,
or waits for begin/finalize and then observes the reservation/new watermark.
An expired lease with a non-null `active_run_id` is still unfinished for
classification and cannot authorize a decision; the next PR2 begin is the only
path that marks it partial and replaces the reservation.

Migration 039 also adds a monotonic `reservation_sequence` to sync runs. PR2's
run insert evaluates its default only after acquiring the connection lock, so
a transaction that began earlier but waited behind another run still sorts
after the run it causally follows. Runtime readiness and PR3 approval identify
the latest run by this sequence, never by transaction-scoped `started_at`.

If the finalization transaction commits but its transport response is lost,
the caller performs one durable reconciliation by run ID. It reports complete
only when that exact run is complete and its bounds, generation, and completion
timestamp match the current watermark. An immediate `not_completed` read can
race a commit that is not visible yet, so it also returns `indeterminate`. The
same indeterminate result applies when reconciliation transport or storage
fails. Neither branch calls the partial-state RPC. Headquarters must say the
result is not yet known; it must not claim either completion or that the
previous schedule stayed unchanged. Status polling is the only later resolver
of durable truth, including when finalization truly rolled back.

No partial run touches the previous watermark. Missing visits are not deleted,
cancelled, completed, or otherwise inferred. A later full-range run is the
reconciliation path when a visit's `startAt` moves.

Migration 039 adds one narrow downstream safety exception without changing
PR2's provider semantics: after 039, successful COMPLETE finalization may
indirectly demote an already approved Jobber-backed `member_appointments` row
to `pending_review` when the new durable manifest omits that exact visit. It
appends immutable invalidation evidence and never creates or promotes an
appointment, infers cancellation/deletion/completion, fulfills an obligation,
or enables billing. Partial, failed, running, and indeterminate attempts do not
advance the watermark and cannot trigger this demotion.

The former `POST /api/admin/care-operations/jobber/visits/sample` projection
writer now returns `410`. Its read-only `GET` preview remains available for the
supervised property-review panel, but source projection fields advance only in
the migration-038 stable finalizer.

## Provider evidence and fixtures

The sanitized API 2025-04-16 evidence is stored in
`lib/care-operations/fixtures/jobber-2025-04-16-schema.json`. It records:

- `visits(filter: VisitFilterAttributes, sort: [VisitsSortInput!], timezone, after, before, first, last)`;
- `VisitFilterAttributes.startAt: Iso8601DateTimeRangeInput`;
- range fields `min`, `max`, `eq`, `before`, and `after`;
- sort keys `CREATED_AT`, `START_AT`, `CLIENT_PRIMARY_NAME`, and `STATUS`;
- Relay cursors exist, but no unique sort or tie-break guarantee was proven.

The exact visit-status enum was not captured before the temporary GraphiQL
token expired. PR2 therefore stores the provider value as an opaque string and
makes no status-enum assumption.

The 429 and version-warning fixtures are explicitly simulated. They test abort
behavior without intentionally rate-limiting or otherwise contacting Jobber.
No fixture contains a token, secret, account identifier, or real customer data.

Provider timestamps must be strict RFC 3339 values representing a real calendar
date and time. Impossible dates such as February 30 or a non-leap February 29
abort the run; valid offsets are converted to canonical UTC ISO timestamps.
GraphQL `errors`, when present, must be an array. A non-array is malformed, a
non-empty array is partial, and an empty array may proceed.

## Duration and lease envelope

The POST route declares Next.js `maxDuration = 300`. Next.js documents this as
a deployment-platform hint, not proof that a platform or account honors it.
PR2 permits at most 14 sequential GraphQL requests across both passes and at
most one token-refresh request. At the 15-second per-request timeout, provider
wait is bounded to 225 seconds, leaving 75 seconds of the requested route
envelope for persistence and application work. Reaching the GraphQL cap is
partial and never advances the watermark.

The durable lease lasts 10 minutes, but every GraphQL request and any token
refresh request is preceded by an exact-run renewal RPC. Renewal succeeds only
while the run is still running,
the same run still owns the lock, and its prior lease has not expired. It never
revives an expired lease. A paused worker that expires or is replaced fails
before its next Jobber call.

Release requires runtime evidence that the target deployment honors at least
the declared 300-second route envelope. No Vercel plan or platform limit is
assumed here. If that precondition is false, the manual sync must remain
disabled until an approved execution design fits the proven runtime.

The 14-request capacity is also a release-data gate, not a claim about the
real schedule. Before enablement, a separately approved read-only rehearsal for
the target connection must prove both complete passes fit within the cap. If
that evidence is unavailable or reaches the cap, the manual action remains
disabled and the run remains partial; PR2 does not raise the cap by assumption.

## Release prerequisites

These steps require separate approval. This runbook does not authorize a
migration, merge, deployment, Jobber call, or production-data change.

1. Rehearse migrations 035 through 038, twice, on a disposable Supabase project.
2. Run the rollback-only SQL harness:

   ```bash
   psql --set ON_ERROR_STOP=1 --file lib/persistence/supabase/tests/038_jobber_schedule_coverage_sync.sql
   ```

3. Confirm all five migration-038 tables have RLS enabled, no `anon`,
   `authenticated`, or `public` policies, and only `service_role` can execute
   the seven coverage-control RPCs.
4. Confirm `JOBBER_GRAPHQL_VERSION=2025-04-16` exactly matches the connected
   row. A warning or different response version is an abort, not an upgrade.
5. In an isolated preview with simulated provider data, prove unauthenticated
   `401`, unapproved `403`, one active run per connection, complete/partial/stale
   UI states, and a 30-minute freshness transition.
6. Record row counts or hashes for the forbidden domains before and after the
   preview rehearsal. They must remain unchanged.
7. Prove the target deployment honors the declared 300-second route envelope.
8. Prove with separately approved read-only release evidence that the target
   connection completes both fixed-window passes within 14 GraphQL requests.
9. After the intended files are added to the index by the release owner, run
   `git diff --cached --check` and enumerate the cached diff. Until then, the
   currently untracked PR2 files cannot be claimed as proven by `git diff`.

## Repository verification

Run from the isolated PR2 worktree:

```bash
npx tsc --noEmit
npm test
npm run lint
git diff --check
```

Focused coverage tests additionally prove partition boundaries, overflow
splitting, exact-50 leaves, equal timestamps, two-pass equality/disagreement,
caps, unsplittable saturation, partial GraphQL responses, 429, timeout,
malformed timestamps, version warning/mismatch, actor recording, 401/403,
concurrent locking, replay, storage failure, stale-write rejection, immutable
evidence, CAS, partial-watermark preservation, atomic stable finalization,
lost-response reconciliation, strict calendar timestamps, pre-request lease
fencing, and watermark-bound status counts.

The SQL harness is credential-gated by its operator: run it only on a disposable
database. It opens a transaction, creates synthetic `.invalid` fixtures, proves
the invariants, and ends with `ROLLBACK`.

### PR2 implementation evidence — 2026-07-16

The isolated worktree at `4bbe24f19c3edfc3e5b097033b3ca78ba5e0f998`
produced this evidence without contacting Jobber or a database:

- focused PR2/provider-token tests: `6 passed` test files and `68 passed`
  tests.
- `npm test`: `93 passed | 3 skipped` test files and `528 passed | 10 skipped`
  tests. The skipped migration integration test requires the explicit
  disposable-database acknowledgement and URL.
- focused ESLint over every changed TypeScript/TSX/MJS file: exit 0 with no
  output.
- `npx tsc --noEmit`: exit 2 with zero PR2-local diagnostics after the
  delayed-visibility callback was explicitly typed `() => void`. Diagnostics
  remain only in these unchanged tracked test fixtures:
  `member-vs-onetime.test.ts`, `member-wallet-card-data.test.ts`,
  `portal-view-model.test.ts`, `client.test.ts`, `calculations.test.ts`, and
  `tier-benefits.test.ts`. `git diff --name-only 4bbe24f -- <those files>`
  returned no output. A scoped `tsc --noEmit` covering the new provider, sync,
  store, routes, and UI exited 0 with no output.
- `git diff --check`: exit 0 with no output.
- `npm run audit:migrations`: not executed against a database; the command
  stopped with `Missing SUPABASE_DB_URL or DATABASE_URL in .env.local`.

This is repository evidence, not release approval. Migrations 035 through 038
and the rollback-only SQL harness still require a separately approved,
disposable Supabase rehearsal before release.

The six full-TypeScript failures are inherited release evidence, not PR2 scope.
They require a separate founder decision; PR2 does not modify those fixtures.
Because the new PR2 files remain untracked, repository `git diff` alone does not
prove their eventual staged contents. The explicit focused test, lint, and
scoped-typecheck paths are the current implementation evidence; cached-diff
verification remains a release prerequisite after those files are tracked.

The supplied `/Users/nts/SqueegeeOS/node_modules` tree did not contain the
declared `@supabase/ssr` package, so an initial full test attempt stopped in
three unchanged auth suites (`90 passed`, `3 failed`, `3 skipped` files). The
successful evidence above used the same supplied Node 24.18.0 binary with the
existing isolated dependency tree that contains that declared package. No
dependency installation or main-worktree write was performed.

## Post-deploy verification after separate approval

1. Sign in as an approved Headquarters actor and open Production Health.
2. Before calling Jobber, verify status is honestly `Stale` or reflects an
   earlier durable run; never assume connection status is coverage proof.
3. Press **Refresh Jobber schedule** once. Do not retry a partial 429, timeout,
   version warning, or version mismatch repeatedly.
4. A complete result must show a fresh watermark, identical pass counts, the
   actor UUID on the run, the visit count from `watermark.run_id`, and no active
   lock. A newer running attempt must be shown separately from that count.
5. A simulated or naturally occurring partial result must leave the prior
   watermark byte-for-byte unchanged and show the latest run as partial.
6. Confirm Jobber-only and unclassified projections remain outside Today and
   the member portal. After migration 039, also confirm a later complete
   manifest omission demotes existing authority and hides it from both surfaces
   without changing appointment status or inferring cancellation. Confirm no
   forbidden-domain row count or reconciliation hash changed.

## Rollback

Migration 038 is additive. Once real run or observation evidence exists, keep
the tables and immutable rows. Roll back application code to the previous
approved build or remove access to the manual control in a forward fix; do not
drop tables, delete observations, rewrite run outcomes, or move the watermark
by hand.

If a run is interrupted, its 10-minute durable lease expires. The next manual
reservation marks the abandoned running row partial before acquiring the lock.
Do not repair it to complete. A new two-pass full-window run is the recovery.

Destructive schema rollback is appropriate only inside a disposable,
pre-production database and still requires explicit approval. No destructive
rollback SQL is shipped.
