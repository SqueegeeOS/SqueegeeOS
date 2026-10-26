# Jobber webhook recovery — 2026-10-26

## Verified problem

Read-only production audit at 06:29 UTC found 53 eligible current/future Jobber
projections, all assigned to active technician Tyler Germany. The automatic
dispatch trigger was enabled and matched the checked-in function. All 53 had
street addresses and readable service scopes; nine were within the upcoming
45-day view. Assignments are in HomeAtlas, not mutations to Jobber staffing.

The weak link was ingestion, not the dispatch rule. Of 30 webhooks received in
the preceding week, 26 were eventually marked covered by a full repair snapshot,
one client webhook completed directly, and three remained failed/processing.
The October 24 create/update burst waited 75,254 seconds for reconciliation.
The latest snapshot was October 25 at 23:43:44 UTC. The daily cron is intentionally
17:17 UTC; snapshot age alone does not demonstrate that cron failed.

The old webhook acknowledged before persisting and launched a separate full
historical snapshot per event under a 60-second route budget. Exact historical
runtime errors could not be retrieved because the Vercel Hobby retention window
had elapsed. Timeout/rate contention is a supported diagnosis, not a recovered
runtime exception.

## Repair

- Persist a deduplicated inbox record before returning 202; persistence errors
  return 503 so Jobber can redeliver. Signature verification remains first.
- Use the existing 300-second repair-route budget for webhook background work.
- Claim batches using one database lease per connected account. Concurrent
  instances do not each traverse Jobber history for the same burst.
- Finish only exact claimed event keys. Events arriving during a snapshot are
  drained by a subsequent snapshot, never acknowledged using older source data.
- Failed events and abandoned processing events are eligible for recovery on
  later deliveries, including duplicate delivery. A transient failure receives
  one short retry; two consecutive failures stop the worker without losing data.
- Stop starting batches after 180 seconds. A killed worker's 330-second lease
  expires. Owner checks fence event finalization and lease release.

No customer communication, billing execution, Jobber mutation, assignment-policy
change, or cron schedule change is introduced. The existing daily reconciliation
route has billing/communication side effects: **do not invoke it merely to test
this fix**.

## Deployment order and rollback

1. Apply `20261026063712_jobber_webhook_batch_recovery.sql` through the authorized
   migration process, then inspect function grants and RLS.
2. Deploy the application. Deploying first retains inbox records but cannot run
   the new worker until its RPCs exist.
3. Observe a real delivery, its exact batch completion, snapshot freshness, and
   eligible-assignment coverage. An HTTP 202 alone is not proof of sync success.

The migration adds an empty lease table, a nullable processing-owner column, and
two SECURITY INVOKER functions. Only the existing backend `service_role` can use
them; PUBLIC/anon/authenticated cannot. It does not grant broader access to
existing sensitive tables and performs no customer-data backfill.

If needed, roll the application back first and leave the additive schema in
place; the old application remains compatible. Do not drop coordination objects
while new workers are running. Production state must not be described as fixed
solely because the migration/deployment succeeded.

## Remaining limits

This is bounded webhook recovery, not a managed durable queue. A persistent
provider failure or process kill can still wait for the next webhook or the
daily repair. Hobby cron frequency is not changed. The lease coordinates
webhook workers only, not manual/cron snapshots. Projection writes themselves
do not have a generation fence: delayed in-flight writes and concurrent manual
snapshots remain a broader snapshot-consistency hardening opportunity.

## Verification

```sh
npx vitest run lib/integrations/jobber-webhook.test.ts \
  lib/integrations/jobber-webhook-worker.test.ts \
  lib/integrations/jobber-webhook-route.test.ts \
  lib/admin/customer-data-boundaries.test.ts
node scripts/test-jobber-webhook-postgres.mjs /path/to/postgres/bin
```

The PostgreSQL rehearsal creates and destroys an isolated local temporary
cluster, accepts no database URL, and tests true two-session contention,
exact event acknowledgement, follow-on arrivals, failed/stale recovery,
wrong-account rejection, stale-owner fencing, service-role execution, RLS,
and lack of anon/authenticated access. It never connects to production.
