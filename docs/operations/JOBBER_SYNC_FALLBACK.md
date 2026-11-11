# Frequent Jobber backup sync

## Behavior

Jobber webhooks remain the fastest path. A dedicated `/api/cron/jobber-sync`
route performs a full client/visit projection refresh every 15 minutes at
:11, :26, :41 and :56 UTC. These offsets leave the preceding five-minute
fallback window clear of the existing 17:17 daily reconciliation and 08:07
first-of-month billing invocations. Customer texts, reviews, geocoding and
billing are not called by the new route. Their existing schedules are unchanged.

The route uses the existing `CRON_SECRET`, returns 401 without work when it is
missing or incorrect, never caches its response, and has a 300-second budget.
It acknowledges only durable webhook events that predate a successful snapshot.
Failures return 500 without claiming successful reconciliation. A concurrent
sync returns 202 with `skipped: sync_in_progress`, not a false completed sync.

## Shared lock

All full/client/visit sync functions now use the same private
`jobber_webhook_sync_leases` row that webhook claims already lock. A conditional
UPDATE acquires only an empty or expired lease. PostgreSQL rechecks that condition
after row-lock contention. Insert-on-conflict never overwrites an owner.
AsyncLocalStorage carries ownership through nested full/client/visit operations;
independent requests cannot borrow it. The webhook worker adopts only its own
freshly claimed lease and still owns batch finalization/release.

The 330-second lifetime exceeds all current sync route budgets (300 seconds).
Release is owner-checked, including after errors. A failed release leaves expiry
as the recovery path. Interactive refreshes return a clear 409 and Retry-After
when another worker is already syncing. Scheduled reconciliation and first-of-month billing wait for a busy lease for
up to 90 seconds, capped within the request’s first 120 seconds so they retain
time for a fresh snapshot and downstream safeguards. Persistent contention still
fails closed if a fresh snapshot cannot be obtained; it never charges using a skipped
sync. All sync routes wake pending webhook processing after their work so events
received while the shared lease was held can catch up promptly.

## Release requirements

- Merge only this feature's scheduler entry with other releases. Do not replace
  `vercel.json` wholesale or remove new entries added by another release.
- No migration, new dependency, credential or environment change is required.
  The existing webhook lease table, RPCs and backend-only grants must be present.
  They were verified read-only in production during preparation.
- Ensure the project is on Vercel Pro and cron jobs are enabled. Deploy the exact
  reviewed main commit; preview builds do not register production cron runs.
- Allow existing production functions to drain (up to 300 seconds) during rollout.
  Older manual/daily snapshots do not use the shared lock. For that mixed-version
  window, avoid manually triggering parallel syncs.
- Inspect Vercel's registered schedule and one actual backup invocation. Verify
  response/log outcome, clients/visits freshness and durable inbox status. A READY
  deployment or HTTP 202 alone is not evidence that synchronization completed.
- Do not invoke `/api/cron/jobber-reconcile` to test this feature: that route has
  automatic billing and customer-message side effects. Use the new sync-only
  route or observe a real scheduled invocation.

## Cost and residual limits

This adds up to 96 full snapshots per day. Each snapshot reads every client and
visit page plus metadata queries. Webhooks remain the low-latency path; the cron
is missed-event recovery, not an attempt to replace event-driven updates with
constant polling. Monitor function duration,
Jobber throttling and Vercel/Supabase usage before shortening the interval.

Vercel legacy cron delivery is best-effort and does not retry failures. A killed
worker leaves its durable events intact for the next webhook or backup. Expiry
uses host UTC timestamps for direct snapshot claims, so runtime clocks must stay
synchronized. Projection writes are not generation-fenced; the 330-second lease
relies on the configured 300-second execution bound. Very late in-flight DB
writes remain a broader hardening opportunity. The existing 200-page pagination
guard and full-history traversal are unchanged (currently roughly 2,000 visits).

## Verification and rollback

Unit/route tests cover auth, no side effects, lock acquisition/failure, nested
ownership, independent requests, busy outcomes and event acknowledgement order.
`scripts/test-jobber-webhook-postgres.mjs` additionally covers native two-session
contention and webhook/snapshot mutual exclusion when local PostgreSQL binaries
are available. PGlite rehearsal can validate the SQL/grants and sequential
cross-path behavior but is not equivalent to a native multi-session test.

Rollback the application deployment to remove the new cron entry. No schema
rollback is needed. Do not clear an active lease by hand; let the owner release
it or wait for expiry. Keep the existing daily and monthly automation schedules.
