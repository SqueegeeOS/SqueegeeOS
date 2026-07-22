import { Pool, type PoolClient } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  assertForbiddenDomainFingerprintsUnchanged,
  captureForbiddenDomainFingerprints,
  installForbiddenDomainFingerprints,
  isAcknowledgedDisposableJobberDatabase,
  loadPsqlRehearsal,
} from "./tests/support/disposable-postgres";

const integration = isAcknowledgedDisposableJobberDatabase()
  ? describe
  : describe.skip;
const fixture = loadPsqlRehearsal(
  new URL(
    "./tests/support/043_authoritative_visit_completion_concurrency_fixture.sql",
    import.meta.url,
  ),
);
const cleanup = loadPsqlRehearsal(
  new URL(
    "./tests/support/043_authoritative_visit_completion_concurrency_cleanup.sql",
    import.meta.url,
  ),
);

const ACTOR_ID = "10000000-0000-4000-8000-000000000043";
const MEMBERSHIP_ID = "40000000-0000-4000-8000-000000000043";
const PROJECTION_ID = "70000000-0000-4000-8000-000000000043";
const LINK_ID = "80000000-0000-4000-8000-000000000043";
const CLASSIFICATION_ID = "90000000-0000-4000-8000-000000000043";
const APPOINTMENT_ID = "a0000000-0000-4000-8000-000000000043";
const FINALIZE_RUN_ID = "f0000000-0000-4000-8000-000000000043";
const BEGIN_RUN_ID = "f0000000-0000-4000-8000-000000000044";
const HARNESS_ACCOUNT_ID = "disposable-concurrency-043";
const COMPLETION_REASON = "Disposable supervised completion race";

interface ReviewTokens {
  classificationUpdatedAt: string;
  linkUpdatedAt: string;
}

interface RpcResult {
  outcome: string;
  appointment_id?: string;
  completion_event_id?: string;
}

interface AuthoritativeRaceState {
  appointmentCount: string;
  appointmentId: string | null;
  appointmentStatus: string | null;
  appointmentAuthorityState: string | null;
  appointmentVerificationState: string | null;
  appointmentMatchState: string | null;
  appointmentCompletedAt: string | null;
  appointmentSourceHash: string | null;
  completionEventCount: string;
  completionEventActorId: string | null;
  completionEventReason: string | null;
  classificationState: string | null;
  syncActiveRunId: string | null;
  beginRunStatus: string | null;
  finalizeRunStatus: string | null;
  watermarkRunId: string | null;
  watermarkGeneration: string | null;
  linkState: string | null;
  revokedLinkEventCount: string;
  actorActive: boolean | null;
  membershipStatus: string | null;
}

interface CleanupSentinels {
  connectionAccountId: string | null;
  appointmentCount: string;
  classificationEventCount: string;
  projectionEventCount: string;
  sourceObservationCount: string;
  propertyLinkEventCount: string;
  membershipCount: string;
  actorCount: string;
}

type Settled<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }),
  );
}

async function beginWorker(client: PoolClient): Promise<void> {
  await client.query("begin");
  await client.query("set local lock_timeout = '10s'");
  await client.query("set local statement_timeout = '20s'");
}

async function rollbackQuietly(client: PoolClient): Promise<void> {
  try {
    await client.query("rollback");
  } catch {
    // The guarded disposable cleanup is the final recovery boundary.
  }
}

async function backendPid(client: PoolClient): Promise<number> {
  const result = await client.query<{ pid: number }>(
    "select pg_catalog.pg_backend_pid() as pid",
  );
  return result.rows[0].pid;
}

async function waitUntilBlocked(
  observer: PoolClient,
  blockedPid: number,
  blockerPid: number,
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = await observer.query<{ blocked: boolean }>(
      `select $2::integer = any(
         pg_catalog.pg_blocking_pids($1::integer)
       ) as blocked`,
      [blockedPid, blockerPid],
    );
    if (result.rows[0].blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `PostgreSQL backend ${blockedPid} did not block on backend ${blockerPid}`,
  );
}

async function loadReviewTokens(client: PoolClient): Promise<ReviewTokens> {
  const result = await client.query<ReviewTokens>(
    `select classification.updated_at::text as "classificationUpdatedAt",
            property_link.updated_at::text as "linkUpdatedAt"
     from public.jobber_visit_classifications classification
     join public.jobber_property_links property_link
       on property_link.id = classification.property_link_id
     where classification.id = $1::uuid`,
    [CLASSIFICATION_ID],
  );
  if (result.rowCount !== 1) throw new Error("Race fixture authority is missing");
  return result.rows[0];
}

async function confirmCompletion(
  client: PoolClient,
  tokens: ReviewTokens,
): Promise<RpcResult> {
  const result = await client.query<{ result: RpcResult }>(
    `select public.confirm_jobber_visit_completion(
       $1::uuid, $2::uuid, repeat('c', 64), $3::uuid,
       $4::timestamptz, $5::timestamptz, $6::text, $7::uuid
     ) as result`,
    [
      APPOINTMENT_ID,
      PROJECTION_ID,
      CLASSIFICATION_ID,
      tokens.classificationUpdatedAt,
      tokens.linkUpdatedAt,
      COMPLETION_REASON,
      ACTOR_ID,
    ],
  );
  return result.rows[0].result;
}

async function beginCoverageSync(client: PoolClient): Promise<RpcResult> {
  const result = await client.query<{ result: RpcResult }>(
    `select public.begin_jobber_schedule_coverage_sync(
       $1::uuid, 'squeegeeking', $2::uuid,
       pg_catalog.now() - interval '90 days',
       pg_catalog.now() + interval '365 days', '2025-04-16'
     ) as result`,
    [BEGIN_RUN_ID, ACTOR_ID],
  );
  return result.rows[0].result;
}

async function revokePropertyLink(
  client: PoolClient,
  tokens: ReviewTokens,
): Promise<RpcResult> {
  const result = await client.query<{ result: RpcResult }>(
    `select public.revoke_jobber_property_link(
       $1::uuid, 'squeegeeking', $2::uuid, $3::uuid,
       $4::timestamptz, 'Disposable completion race revocation'
     ) as result`,
    [ACTOR_ID, PROJECTION_ID, LINK_ID, tokens.linkUpdatedAt],
  );
  return result.rows[0].result;
}

async function prepareFinalization(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const reservation = await client.query<{ result: RpcResult }>(
      `select public.begin_jobber_schedule_coverage_sync(
         $1::uuid, 'squeegeeking', $2::uuid,
         pg_catalog.now() - interval '90 days',
         pg_catalog.now() + interval '365 days', '2025-04-16'
       ) as result`,
      [FINALIZE_RUN_ID, ACTOR_ID],
    );
    if (reservation.rows[0].result.outcome !== "acquired") {
      throw new Error("Could not reserve the disposable finalization fixture");
    }

    for (const passNumber of [1, 2]) {
      await client.query(
        `select public.append_jobber_schedule_coverage_leaf(
           $1::uuid, $2::smallint, 0,
           pg_catalog.now() - interval '90 days',
           pg_catalog.now() + interval '365 days', repeat('e', 64),
           pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
             'external_visit_id', projection.external_visit_id,
             'external_job_id', projection.external_job_id,
             'external_client_id', projection.external_client_id,
             'external_property_id', projection.external_property_id,
             'jobber_property_web_uri', projection.jobber_property_web_uri,
             'job_number', projection.job_number,
             'title', projection.title,
             'client_name', projection.client_name,
             'visit_status', projection.visit_status,
             'job_status', projection.job_status,
             'is_complete', projection.is_complete,
             'scheduled_start', projection.scheduled_start,
             'scheduled_end', projection.scheduled_end,
             'completed_at', projection.completed_at,
             'raw_payload', projection.raw_payload,
             'source_payload_hash', projection.source_payload_hash,
             'source_observed_at', projection.source_observed_at
           ))
         )
         from public.jobber_visit_projections projection
         where projection.id = $3::uuid`,
        [FINALIZE_RUN_ID, passNumber, PROJECTION_ID],
      );
      await client.query(
        `select public.complete_jobber_schedule_coverage_pass(
           $1::uuid, $2::smallint, repeat('e', 64), repeat('f', 64),
           1, 1, 1
         )`,
        [FINALIZE_RUN_ID, passNumber],
      );
    }
    await client.query("commit");
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  } finally {
    client.release();
  }
}

async function restoreMembership(
  client: PoolClient,
  originalUpdatedAt: string,
): Promise<void> {
  await client.query("begin");
  await client.query("set local session_replication_role = replica");
  await client.query(
    `update public.memberships
     set status = 'active', cancelled_at = null, updated_at = $2::timestamptz
     where id = $1::uuid`,
    [MEMBERSHIP_ID, originalUpdatedAt],
  );
  await client.query("commit");
}

async function loadAuthoritativeRaceState(
  client: PoolClient,
): Promise<AuthoritativeRaceState> {
  const result = await client.query<AuthoritativeRaceState>(
    `select
       (select count(*)::text from public.jobber_visit_completion_events
        where appointment_id = $1::uuid) as "completionEventCount",
       (select actor_id::text from public.jobber_visit_completion_events
        where appointment_id = $1::uuid) as "completionEventActorId",
       (select reason from public.jobber_visit_completion_events
        where appointment_id = $1::uuid) as "completionEventReason",
       (select count(*)::text from public.member_appointments
        where provider = 'jobber'
          and external_id = 'visit-completion-043-race') as "appointmentCount",
       (select id::text from public.member_appointments
        where id = $1::uuid) as "appointmentId",
       (select status from public.member_appointments
        where id = $1::uuid) as "appointmentStatus",
       (select jobber_authority_state from public.member_appointments
        where id = $1::uuid) as "appointmentAuthorityState",
       (select verification_state from public.member_appointments
        where id = $1::uuid) as "appointmentVerificationState",
       (select match_state from public.member_appointments
        where id = $1::uuid) as "appointmentMatchState",
       (select completed_at::text from public.member_appointments
        where id = $1::uuid) as "appointmentCompletedAt",
       (select source_payload_hash from public.member_appointments
        where id = $1::uuid) as "appointmentSourceHash",
       (select classification_state from public.jobber_visit_classifications
        where id = $2::uuid) as "classificationState",
       (select active_run_id::text from public.jobber_schedule_sync_locks
        where connection_id = 'squeegeeking') as "syncActiveRunId",
       (select status from public.jobber_schedule_sync_runs
        where id = $3::uuid) as "beginRunStatus",
       (select status from public.jobber_schedule_sync_runs
        where id = $4::uuid) as "finalizeRunStatus",
       (select run_id::text from public.jobber_schedule_sync_watermarks
        where connection_id = 'squeegeeking') as "watermarkRunId",
       (select generation::text from public.jobber_schedule_sync_watermarks
        where connection_id = 'squeegeeking') as "watermarkGeneration",
       (select link_state from public.jobber_property_links
        where id = $5::uuid) as "linkState",
       (select count(*)::text from public.jobber_property_link_events
        where link_id = $5::uuid and event_type = 'revoked')
         as "revokedLinkEventCount",
       (select active from public.hq_admin_users
        where user_id = $6::uuid) as "actorActive",
       (select status from public.memberships
        where id = $7::uuid) as "membershipStatus"`,
    [
      APPOINTMENT_ID,
      CLASSIFICATION_ID,
      BEGIN_RUN_ID,
      FINALIZE_RUN_ID,
      LINK_ID,
      ACTOR_ID,
      MEMBERSHIP_ID,
    ],
  );
  return result.rows[0];
}

function expectPendingWithoutCompletion(
  state: AuthoritativeRaceState,
): void {
  expect(state).toMatchObject({
    appointmentCount: "1",
    appointmentId: APPOINTMENT_ID,
    appointmentStatus: "scheduled",
    appointmentAuthorityState: "pending_review",
    appointmentVerificationState: "pending_review",
    appointmentMatchState: "manual_review",
    appointmentCompletedAt: null,
    appointmentSourceHash: "a".repeat(64),
    completionEventCount: "0",
    completionEventActorId: null,
    completionEventReason: null,
    classificationState: "pending_review",
  });
}

function expectOneCompletedIdentity(state: AuthoritativeRaceState): void {
  expect(state).toMatchObject({
    appointmentCount: "1",
    appointmentId: APPOINTMENT_ID,
    appointmentStatus: "completed",
    appointmentAuthorityState: "completed",
    appointmentVerificationState: "verified",
    appointmentMatchState: "matched",
    appointmentSourceHash: "c".repeat(64),
    completionEventCount: "1",
    completionEventActorId: ACTOR_ID,
    completionEventReason: COMPLETION_REASON,
    classificationState: "pending_review",
  });
  expect(state.appointmentCompletedAt).not.toBeNull();
}

async function loadCleanupSentinels(
  client: PoolClient,
): Promise<CleanupSentinels> {
  const result = await client.query<CleanupSentinels>(
    `select
       (select account_id from public.jobber_connections
        where id = 'squeegeeking') as "connectionAccountId",
       (select count(*)::text from public.member_appointments
        where id = $1::uuid) as "appointmentCount",
       (select count(*)::text from public.jobber_visit_classification_events
        where classification_id = $2::uuid) as "classificationEventCount",
       (select count(*)::text from public.jobber_visit_projection_events
        where projection_id = $3::uuid) as "projectionEventCount",
       (select count(*)::text from public.jobber_visit_source_observations
        where run_id = 'b0000000-0000-4000-8000-000000000043')
         as "sourceObservationCount",
       (select count(*)::text from public.jobber_property_link_events
        where link_id = $4::uuid) as "propertyLinkEventCount",
       (select count(*)::text from public.memberships
        where id = $5::uuid) as "membershipCount",
       (select count(*)::text from public.hq_admin_users
        where user_id = $6::uuid) as "actorCount"`,
    [
      APPOINTMENT_ID,
      CLASSIFICATION_ID,
      PROJECTION_ID,
      LINK_ID,
      MEMBERSHIP_ID,
      ACTOR_ID,
    ],
  );
  return result.rows[0];
}

integration("migration 043 disposable two-session race matrix", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.JOBBER_J1_TEST_DATABASE_URL,
      max: 3,
    });
  });

  beforeEach(async () => {
    await pool.query(cleanup);
    await pool.query(fixture);
  });

  afterEach(async () => {
    await pool.query(cleanup);
  });

  afterAll(async () => {
    await pool?.query(cleanup);
    await pool?.end();
  });

  async function withRaceClients(
    run: (context: {
      first: PoolClient;
      second: PoolClient;
      observer: PoolClient;
      firstPid: number;
      secondPid: number;
      tokens: ReviewTokens;
    }) => Promise<void>,
  ): Promise<void> {
    const observer = await pool.connect();
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      const [firstPid, secondPid] = await Promise.all([
        backendPid(first),
        backendPid(second),
      ]);
      expect(firstPid).not.toBe(secondPid);
      await installForbiddenDomainFingerprints(observer);
      await captureForbiddenDomainFingerprints(observer, "before-race");
      const tokens = await loadReviewTokens(observer);
      await run({ first, second, observer, firstPid, secondPid, tokens });
      await captureForbiddenDomainFingerprints(observer, "after-race");
      await assertForbiddenDomainFingerprintsUnchanged(
        observer,
        "before-race",
        "after-race",
      );
    } finally {
      await Promise.all([rollbackQuietly(first), rollbackQuietly(second)]);
      first.release();
      second.release();
      observer.release();
    }
  }

  it("refuses cleanup before deleting any non-marker canonical connection fixture", async () => {
    const client = await pool.connect();
    try {
      const nullable = await client.query<{ isNullable: "YES" | "NO" }>(
        `select is_nullable as "isNullable"
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'jobber_connections'
           and column_name = 'account_id'`,
      );
      const nonMarkerAccountIds: Array<string | null> = [
        "disposable-concurrency-043-non-marker",
      ];
      if (nullable.rows[0]?.isNullable === "YES") {
        nonMarkerAccountIds.push(null);
      }

      for (const accountId of nonMarkerAccountIds) {
        await client.query(
          `update public.jobber_connections
           set account_id = $1::text
           where id = 'squeegeeking'`,
          [accountId],
        );
        const beforeCleanup = await loadCleanupSentinels(client);
        expect(beforeCleanup).toMatchObject({
          connectionAccountId: accountId,
          appointmentCount: "1",
          classificationEventCount: "2",
          projectionEventCount: "2",
          sourceObservationCount: "1",
          propertyLinkEventCount: "1",
          membershipCount: "1",
          actorCount: "1",
        });

        const cleanupAttempt = await settle(client.query(cleanup));
        expect(cleanupAttempt.ok).toBe(false);
        if (!cleanupAttempt.ok) {
          expect(cleanupAttempt.error.message).toContain(
            "Refusing to clean a non-harness squeegeeking connection",
          );
        }
        await rollbackQuietly(client);

        const afterCleanup = await loadCleanupSentinels(client);
        expect(afterCleanup).toEqual(beforeCleanup);
        await client.query(
          `update public.jobber_connections
           set account_id = $1::text
           where id = 'squeegeeking'`,
          [HARNESS_ACCOUNT_ID],
        );
      }
    } finally {
      await rollbackQuietly(client);
      await client.query(
        `update public.jobber_connections
         set account_id = $1::text
         where id = 'squeegeeking'
           and account_id is distinct from $1::text`,
        [HARNESS_ACCOUNT_ID],
      );
      client.release();
    }
  });

  it("serializes completion before a new PR2 sync reservation", async () => {
    await withRaceClients(async (context) => {
      await Promise.all([beginWorker(context.first), beginWorker(context.second)]);
      const completion = await confirmCompletion(context.first, context.tokens);
      expect(completion.outcome).toBe("completed");

      const pendingBegin = settle(beginCoverageSync(context.second));
      await waitUntilBlocked(
        context.observer,
        context.secondPid,
        context.firstPid,
      );
      await context.first.query("commit");
      const beginResult = await pendingBegin;
      expect(beginResult.ok).toBe(true);
      if (beginResult.ok) expect(beginResult.value.outcome).toBe("acquired");
      await context.second.query("commit");

      const state = await loadAuthoritativeRaceState(context.observer);
      expectOneCompletedIdentity(state);
      expect(state).toMatchObject({
        syncActiveRunId: BEGIN_RUN_ID,
        beginRunStatus: "running",
        finalizeRunStatus: null,
        watermarkRunId: "b0000000-0000-4000-8000-000000000043",
        watermarkGeneration: "1",
        linkState: "active",
        revokedLinkEventCount: "0",
        actorActive: true,
        membershipStatus: "active",
      });
    });
  });

  it("fails completion closed when PR2 begin reserves first", async () => {
    await withRaceClients(async (context) => {
      await Promise.all([beginWorker(context.first), beginWorker(context.second)]);
      const reservation = await beginCoverageSync(context.first);
      expect(reservation.outcome).toBe("acquired");

      const pendingCompletion = settle(
        confirmCompletion(context.second, context.tokens),
      );
      await waitUntilBlocked(
        context.observer,
        context.secondPid,
        context.firstPid,
      );
      await context.first.query("commit");
      const completion = await pendingCompletion;
      expect(completion.ok).toBe(false);
      if (!completion.ok) expect(completion.error.message).toContain("completion_conflict:");
      await context.second.query("rollback");

      const state = await loadAuthoritativeRaceState(context.observer);
      expectPendingWithoutCompletion(state);
      expect(state).toMatchObject({
        syncActiveRunId: BEGIN_RUN_ID,
        beginRunStatus: "running",
        finalizeRunStatus: null,
        watermarkRunId: "b0000000-0000-4000-8000-000000000043",
        watermarkGeneration: "1",
        linkState: "active",
        revokedLinkEventCount: "0",
        actorActive: true,
        membershipStatus: "active",
      });
    });
  });

  it("waits for PR2 finalize and then confirms against its complete watermark", async () => {
    await prepareFinalization(pool);
    await withRaceClients(async (context) => {
      await Promise.all([beginWorker(context.first), beginWorker(context.second)]);
      const finalized = await context.first.query<{ result: string }>(
        "select public.finalize_jobber_schedule_coverage_sync($1::uuid, 1) as result",
        [FINALIZE_RUN_ID],
      );
      expect(finalized.rows[0].result).toBe("completed");

      const pendingCompletion = settle(
        confirmCompletion(context.second, context.tokens),
      );
      await waitUntilBlocked(
        context.observer,
        context.secondPid,
        context.firstPid,
      );
      await context.first.query("commit");
      const completion = await pendingCompletion;
      expect(completion.ok).toBe(true);
      if (completion.ok) expect(completion.value.outcome).toBe("completed");
      await context.second.query("commit");

      const state = await loadAuthoritativeRaceState(context.observer);
      expectOneCompletedIdentity(state);
      expect(state).toMatchObject({
        syncActiveRunId: null,
        beginRunStatus: null,
        finalizeRunStatus: "complete",
        watermarkRunId: FINALIZE_RUN_ID,
        watermarkGeneration: "2",
        linkState: "active",
        revokedLinkEventCount: "0",
        actorActive: true,
        membershipStatus: "active",
      });
    });
  });

  it("fails completion closed while a PR2 finalization remains reserved", async () => {
    await prepareFinalization(pool);
    await withRaceClients(async (context) => {
      await Promise.all([beginWorker(context.first), beginWorker(context.second)]);
      await context.first.query(
        "select id from public.jobber_schedule_sync_runs where id = $1::uuid for update",
        [FINALIZE_RUN_ID],
      );
      const completion = await settle(
        confirmCompletion(context.second, context.tokens),
      );
      expect(completion.ok).toBe(false);
      if (!completion.ok) expect(completion.error.message).toContain("completion_conflict:");
      await context.second.query("rollback");

      const finalized = await context.first.query<{ result: string }>(
        "select public.finalize_jobber_schedule_coverage_sync($1::uuid, 1) as result",
        [FINALIZE_RUN_ID],
      );
      expect(finalized.rows[0].result).toBe("completed");
      await context.first.query("commit");

      const state = await loadAuthoritativeRaceState(context.observer);
      expectPendingWithoutCompletion(state);
      expect(state).toMatchObject({
        syncActiveRunId: null,
        beginRunStatus: null,
        finalizeRunStatus: "complete",
        watermarkRunId: FINALIZE_RUN_ID,
        watermarkGeneration: "2",
        linkState: "active",
        revokedLinkEventCount: "0",
        actorActive: true,
        membershipStatus: "active",
      });
    });
  });

  it("fails completion closed when property-link revocation wins", async () => {
    await withRaceClients(async (context) => {
      await Promise.all([beginWorker(context.first), beginWorker(context.second)]);
      const revocation = await revokePropertyLink(context.first, context.tokens);
      expect(revocation.outcome).toBe("revoked");

      const pendingCompletion = settle(
        confirmCompletion(context.second, context.tokens),
      );
      await waitUntilBlocked(
        context.observer,
        context.secondPid,
        context.firstPid,
      );
      await context.first.query("commit");
      const completion = await pendingCompletion;
      expect(completion.ok).toBe(false);
      if (!completion.ok) expect(completion.error.message).toContain("completion_conflict:");
      await context.second.query("rollback");

      const state = await loadAuthoritativeRaceState(context.observer);
      expectPendingWithoutCompletion(state);
      expect(state).toMatchObject({
        syncActiveRunId: null,
        beginRunStatus: null,
        finalizeRunStatus: null,
        watermarkRunId: "b0000000-0000-4000-8000-000000000043",
        watermarkGeneration: "1",
        linkState: "revoked",
        revokedLinkEventCount: "1",
        actorActive: true,
        membershipStatus: "active",
      });
    });
  });

  it("fails completion closed when actor deactivation wins", async () => {
    await withRaceClients(async (context) => {
      await Promise.all([beginWorker(context.first), beginWorker(context.second)]);
      await context.first.query(
        "update public.hq_admin_users set active = false where user_id = $1::uuid",
        [ACTOR_ID],
      );
      const pendingCompletion = settle(
        confirmCompletion(context.second, context.tokens),
      );
      await waitUntilBlocked(
        context.observer,
        context.secondPid,
        context.firstPid,
      );
      await context.first.query("commit");
      const completion = await pendingCompletion;
      expect(completion.ok).toBe(false);
      if (!completion.ok) expect(completion.error.message).toContain("completion_conflict:");
      await context.second.query("rollback");

      const state = await loadAuthoritativeRaceState(context.observer);
      expectPendingWithoutCompletion(state);
      expect(state).toMatchObject({
        syncActiveRunId: null,
        beginRunStatus: null,
        finalizeRunStatus: null,
        watermarkRunId: "b0000000-0000-4000-8000-000000000043",
        watermarkGeneration: "1",
        linkState: "active",
        revokedLinkEventCount: "0",
        actorActive: false,
        membershipStatus: "active",
      });
    });
  });

  it("fails completion closed when membership pause wins", async () => {
    await withRaceClients(async (context) => {
      const membership = await context.observer.query<{ updatedAt: string }>(
        `select updated_at::text as "updatedAt"
         from public.memberships where id = $1::uuid`,
        [MEMBERSHIP_ID],
      );
      await Promise.all([beginWorker(context.first), beginWorker(context.second)]);
      await context.first.query(
        "update public.memberships set status = 'paused' where id = $1::uuid",
        [MEMBERSHIP_ID],
      );
      const pendingCompletion = settle(
        confirmCompletion(context.second, context.tokens),
      );
      await waitUntilBlocked(
        context.observer,
        context.secondPid,
        context.firstPid,
      );
      await context.first.query("commit");
      const completion = await pendingCompletion;
      expect(completion.ok).toBe(false);
      if (!completion.ok) expect(completion.error.message).toContain("completion_conflict:");
      await context.second.query("rollback");

      const state = await loadAuthoritativeRaceState(context.observer);
      expectPendingWithoutCompletion(state);
      expect(state).toMatchObject({
        syncActiveRunId: null,
        beginRunStatus: null,
        finalizeRunStatus: null,
        watermarkRunId: "b0000000-0000-4000-8000-000000000043",
        watermarkGeneration: "1",
        linkState: "active",
        revokedLinkEventCount: "0",
        actorActive: true,
        membershipStatus: "paused",
      });
      await restoreMembership(context.first, membership.rows[0].updatedAt);
    });
  });

  it("serializes a membership cancellation after committed completion", async () => {
    await withRaceClients(async (context) => {
      const membership = await context.observer.query<{ updatedAt: string }>(
        `select updated_at::text as "updatedAt"
         from public.memberships where id = $1::uuid`,
        [MEMBERSHIP_ID],
      );
      await Promise.all([beginWorker(context.first), beginWorker(context.second)]);
      const completion = await confirmCompletion(context.first, context.tokens);
      expect(completion.outcome).toBe("completed");

      const pendingCancellation = settle(
        context.second.query(
          "update public.memberships set status = 'cancelled' where id = $1::uuid",
          [MEMBERSHIP_ID],
        ),
      );
      await waitUntilBlocked(
        context.observer,
        context.secondPid,
        context.firstPid,
      );
      await context.first.query("commit");
      const cancellation = await pendingCancellation;
      expect(cancellation.ok).toBe(true);
      await context.second.query("commit");

      const state = await loadAuthoritativeRaceState(context.observer);
      expectOneCompletedIdentity(state);
      expect(state).toMatchObject({
        syncActiveRunId: null,
        beginRunStatus: null,
        finalizeRunStatus: null,
        watermarkRunId: "b0000000-0000-4000-8000-000000000043",
        watermarkGeneration: "1",
        linkState: "active",
        revokedLinkEventCount: "0",
        actorActive: true,
        membershipStatus: "cancelled",
      });
      await restoreMembership(context.first, membership.rows[0].updatedAt);
    });
  });

  it("converges concurrent exact confirmations to one event and one appointment", async () => {
    await withRaceClients(async (context) => {
      await Promise.all([beginWorker(context.first), beginWorker(context.second)]);
      const firstCompletion = await confirmCompletion(context.first, context.tokens);
      expect(firstCompletion.outcome).toBe("completed");

      const pendingReplay = settle(
        confirmCompletion(context.second, context.tokens),
      );
      await waitUntilBlocked(
        context.observer,
        context.secondPid,
        context.firstPid,
      );
      await context.first.query("commit");
      const replay = await pendingReplay;
      expect(replay.ok).toBe(true);
      if (replay.ok) expect(replay.value.outcome).toBe("replay");
      await context.second.query("commit");

      const state = await loadAuthoritativeRaceState(context.observer);
      expectOneCompletedIdentity(state);
      expect(state).toMatchObject({
        syncActiveRunId: null,
        beginRunStatus: null,
        finalizeRunStatus: null,
        watermarkRunId: "b0000000-0000-4000-8000-000000000043",
        watermarkGeneration: "1",
        linkState: "active",
        revokedLinkEventCount: "0",
        actorActive: true,
        membershipStatus: "active",
      });
    });
  });
});
