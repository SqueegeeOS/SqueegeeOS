import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  isAcknowledgedDisposableJobberDatabase,
  loadPsqlRehearsal,
} from "./tests/support/disposable-postgres";

const integration = isAcknowledgedDisposableJobberDatabase()
  ? describe
  : describe.skip;
const rehearsal = loadPsqlRehearsal(
  new URL("./tests/045_jobber_coverage_resume.sql", import.meta.url),
);

interface Acquisition {
  outcome: "started" | "resumed" | "locked";
  run_id: string;
  acquisition_generation: number;
  owner_token: string;
}

type Settled<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );
}

function sqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

async function waitUntilBlockedBy(
  observer: PoolClient,
  blockedPid: number,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ is_blocked: boolean }>(
      `select $2::integer = any(pg_catalog.pg_blocking_pids($1::integer))
       as is_blocked`,
      [blockedPid, blockerPid],
    );
    if (result.rows[0]?.is_blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Ownership mutation did not reach the deterministic lock barrier");
}

function takeoverBarrier() {
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
}

async function acquire(
  client: PoolClient,
  proposedRunId: string,
  actorId: string,
): Promise<Acquisition> {
  const result = await client.query<{ acquisition: Acquisition }>(
    `select public.start_or_resume_jobber_schedule_coverage_sync(
       $1::uuid, 'squeegeeking', $2::uuid,
       '2026-04-17T07:00:00Z'::timestamptz,
       '2027-07-17T07:00:00Z'::timestamptz,
       '2025-04-16'
     ) as acquisition`,
    [proposedRunId, actorId],
  );
  const acquisition = result.rows[0]?.acquisition;
  if (!acquisition) throw new Error("Acquisition result was missing");
  return acquisition;
}

async function cleanupTwoSessionFixture(client: PoolClient): Promise<void> {
  await client.query("rollback").catch(() => {});
  await client.query("begin");
  try {
    await client.query("set local session_replication_role = replica");
    await client.query(`
      delete from public.jobber_visit_source_observations
      where run_id in (
        select id from public.jobber_schedule_sync_runs
        where connection_id = 'squeegeeking'
      );
      delete from public.jobber_schedule_sync_partitions
      where run_id in (
        select id from public.jobber_schedule_sync_runs
        where connection_id = 'squeegeeking'
      );
      delete from public.jobber_schedule_sync_request_attempts
      where run_id in (
        select id from public.jobber_schedule_sync_runs
        where connection_id = 'squeegeeking'
      );
      delete from public.jobber_schedule_sync_work_items
      where run_id in (
        select id from public.jobber_schedule_sync_runs
        where connection_id = 'squeegeeking'
      );
      delete from public.jobber_schedule_sync_watermarks
      where connection_id = 'squeegeeking';
      delete from public.jobber_schedule_sync_locks
      where connection_id = 'squeegeeking';
      delete from public.jobber_schedule_sync_runs
      where connection_id = 'squeegeeking';
      delete from public.jobber_connections
      where id = 'squeegeeking';
      delete from public.hq_admin_users
      where user_id = '00000000-0000-4000-8000-000000004145';
      delete from auth.users
      where id = '00000000-0000-4000-8000-000000004145';
    `);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  }
}

integration("migration 045 disposable resumable-coverage rehearsal", () => {
  let pool: Pool;
  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.JOBBER_J1_TEST_DATABASE_URL,
      max: 2,
    });
  });
  afterAll(async () => pool?.end());

  it("proves continuation, crash replay, one-owner leasing, finalization, ACL, and forbidden-domain contracts", async () => {
    await expect(pool.query(rehearsal)).resolves.toBeDefined();
  }, 120_000);

  it("uses deterministic two-session barriers to prove lock order and reject a stale response after takeover", async () => {
    const actorId = "00000000-0000-4000-8000-000000004145";
    const clientA = await pool.connect();
    const clientB = await pool.connect();
    try {
      await cleanupTwoSessionFixture(clientA);
      await clientA.query(`
        insert into auth.users (
          id, instance_id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at
        ) values (
          '00000000-0000-4000-8000-000000004145',
          '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated',
          'coverage-resume-two-session-045@example.invalid', '',
          pg_catalog.now(), '{}'::jsonb, '{}'::jsonb,
          pg_catalog.now(), pg_catalog.now()
        );
        insert into public.hq_admin_users (user_id, email, role, active)
        values (
          '00000000-0000-4000-8000-000000004145',
          'coverage-resume-two-session-045@example.invalid',
          'operator', true
        );
        insert into public.jobber_connections (
          id, status, account_id, account_name, access_token_ciphertext,
          refresh_token_ciphertext, access_token_expires_at, graphql_version
        ) values (
          'squeegeeking', 'connected',
          'disposable-account-two-session-045', 'Disposable Jobber',
          'not-a-real-token', 'not-a-real-token',
          pg_catalog.now() + interval '1 hour', '2025-04-16'
        );
      `);

      const [{ rows: pidARows }, { rows: pidBRows }] = await Promise.all([
        clientA.query<{ pid: number }>("select pg_catalog.pg_backend_pid() as pid"),
        clientB.query<{ pid: number }>("select pg_catalog.pg_backend_pid() as pid"),
      ]);
      expect(pidARows[0]?.pid).not.toBe(pidBRows[0]?.pid);

      const first = await acquire(
        clientA,
        "00000000-0000-4000-8000-000000004245",
        actorId,
      );
      expect(first.outcome).toBe("started");

      await clientB.query("begin");
      await clientB.query("set local deadlock_timeout = '100ms'");
      await clientB.query(
        `select 1 from public.jobber_schedule_sync_locks
         where connection_id = 'squeegeeking'
         for update`,
      );
      const overlappingMutation = settle(
        clientA.query(
          `select public.renew_resumable_jobber_schedule_coverage_sync_lease(
             $1::uuid, $2::uuid, $3::bigint, $4::uuid
           )`,
          [
            first.run_id,
            actorId,
            first.acquisition_generation,
            first.owner_token,
          ],
        ),
      );
      await waitUntilBlockedBy(
        clientB,
        pidARows[0]?.pid ?? 0,
        pidBRows[0]?.pid ?? 0,
      );
      const overlappingAcquisition = await settle(
        acquire(
          clientB,
          "00000000-0000-4000-8000-000000004246",
          actorId,
        ),
      );
      await clientB.query(overlappingAcquisition.ok ? "commit" : "rollback");
      const overlappingMutationResult = await overlappingMutation;

      if (!overlappingAcquisition.ok) {
        expect(sqlState(overlappingAcquisition.error)).not.toBe("40P01");
        throw overlappingAcquisition.error;
      }
      if (!overlappingMutationResult.ok) {
        expect(sqlState(overlappingMutationResult.error)).not.toBe("40P01");
        throw overlappingMutationResult.error;
      }
      expect(overlappingAcquisition.value).toMatchObject({
        outcome: "locked",
        run_id: first.run_id,
      });

      const firstAttempt = await clientA.query<{
        reservation: { attempt_id: string; partition_path: string };
      }>(
        `select public.reserve_jobber_schedule_coverage_attempt(
           $1::uuid, $2::uuid, $3::bigint, $4::uuid,
           '00000000-0000-4000-8000-000000004345'::uuid
         ) as reservation`,
        [first.run_id, actorId, first.acquisition_generation, first.owner_token],
      );
      expect(firstAttempt.rows[0]?.reservation.partition_path).toBe("r");

      const barrier = takeoverBarrier();
      const staleResponse = (async () => {
        await barrier.wait;
        return clientA.query(
          `select public.record_jobber_schedule_coverage_leaf(
             $1::uuid, $2::uuid, $3::bigint, $4::uuid, $5::uuid,
             $6::text, '[]'::jsonb
           )`,
          [
            first.run_id,
            actorId,
            first.acquisition_generation,
            first.owner_token,
            firstAttempt.rows[0]?.reservation.attempt_id,
            "a".repeat(64),
          ],
        );
      })();
      const staleAssertion = expect(staleResponse).rejects.toThrow(
        "ownership fence was lost",
      );

      await clientB.query(
        `update public.jobber_schedule_sync_locks
         set lease_expires_at = pg_catalog.clock_timestamp() - interval '1 second'
         where connection_id = 'squeegeeking'`,
      );
      const takeover = await acquire(
        clientB,
        "00000000-0000-4000-8000-000000004445",
        actorId,
      );
      expect(takeover).toMatchObject({ outcome: "resumed", run_id: first.run_id });
      expect(takeover.acquisition_generation).toBeGreaterThan(
        first.acquisition_generation,
      );
      expect(takeover.owner_token).not.toBe(first.owner_token);

      barrier.release();
      await staleAssertion;

      const replay = await clientB.query<{
        reservation: { partition_path: string };
      }>(
        `select public.reserve_jobber_schedule_coverage_attempt(
           $1::uuid, $2::uuid, $3::bigint, $4::uuid,
           '00000000-0000-4000-8000-000000004545'::uuid
         ) as reservation`,
        [
          takeover.run_id,
          actorId,
          takeover.acquisition_generation,
          takeover.owner_token,
        ],
      );
      expect(replay.rows[0]?.reservation.partition_path).toBe("r");

      await clientB.query(
        `select public.mark_resumable_jobber_schedule_coverage_sync_partial(
           $1::uuid, $2::uuid, $3::bigint, $4::uuid,
           'storage_failure', 2
         )`,
        [
          takeover.run_id,
          actorId,
          takeover.acquisition_generation,
          takeover.owner_token,
        ],
      );
    } finally {
      try {
        await clientB.query("rollback").catch(() => {});
        await cleanupTwoSessionFixture(clientA);
      } finally {
        clientB.release();
        clientA.release();
      }
    }
  }, 120_000);
});
