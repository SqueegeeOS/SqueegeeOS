import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ACK = "I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE";
const configured =
  process.env.JOBBER_J1_DISPOSABLE_DB_ACK === ACK &&
  Boolean(process.env.JOBBER_J1_TEST_DATABASE_URL);
const integration = configured ? describe.sequential : describe.skip;
const migration044 = readFileSync(
  new URL(
    "./migrations/044_jobber_oauth_authority_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

const SAVE_SQL = `select public.save_jobber_connection_with_event(
  $1, $2, $3, $4, $5, $6, $7, $8, $9
) as outcome`;
const EXPECTED_ACCOUNT_ID = "expected-disposable-account";

interface SaveInput {
  operationId: string;
  actorId: string;
  suffix: string;
}

function saveValues(input: SaveInput) {
  return [
    input.operationId,
    EXPECTED_ACCOUNT_ID,
    EXPECTED_ACCOUNT_ID,
    "Disposable SqueegeeKing account",
    `access-ciphertext-${input.suffix}`,
    `refresh-ciphertext-${input.suffix}`,
    "2035-01-01T00:00:00.000Z",
    "rehearsal-version",
    input.actorId,
  ];
}

async function backendPid(client: PoolClient): Promise<number> {
  const result = await client.query<{ pid: number }>(
    "select pg_catalog.pg_backend_pid() as pid",
  );
  return result.rows[0].pid;
}

async function waitForLockBarrier(
  observer: Pool,
  backendPids: number[],
  label: string,
): Promise<void> {
  const deadline = Date.now() + 10_000;
  let lastRows: Array<{
    pid: number;
    state: string | null;
    wait_event_type: string | null;
    wait_event: string | null;
  }> = [];

  while (Date.now() < deadline) {
    const result = await observer.query<{
      pid: number;
      state: string | null;
      wait_event_type: string | null;
      wait_event: string | null;
    }>(
      `select pid, state, wait_event_type, wait_event
       from pg_catalog.pg_stat_activity
       where pid = any($1::integer[])
       order by pid`,
      [backendPids],
    );
    lastRows = result.rows;
    if (
      lastRows.length === backendPids.length &&
      lastRows.every(
        (row) => row.state === "active" && row.wait_event_type === "Lock",
      )
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(
    `${label} did not reach the catalog-observed lock barrier: ${JSON.stringify(lastRows)}`,
  );
}

async function createActor(
  pool: Pool,
  role: "owner" | "operator" = "operator",
): Promise<{ actorId: string; email: string }> {
  const actorId = randomUUID();
  const email = `oauth-044-${actorId}@example.invalid`;
  await pool.query(
    `insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      $1, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', $2, '', pg_catalog.now(),
      '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()
    )`,
    [actorId, email],
  );
  await pool.query(
    `insert into public.hq_admin_users (user_id, email, role, active)
     values ($1, $2, $3, true)`,
    [actorId, email, role],
  );
  return { actorId, email };
}

type AuthorityMutation = "deactivate" | "delete" | "role-change";

function authorityMutationSql(mutation: AuthorityMutation): string {
  if (mutation === "deactivate") {
    return "update public.hq_admin_users set active = false where user_id = $1";
  }
  if (mutation === "delete") {
    return "delete from public.hq_admin_users where user_id = $1";
  }
  return "update public.hq_admin_users set role = 'owner' where user_id = $1";
}

integration("migration 044 Jobber OAuth authority and replay", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.JOBBER_J1_TEST_DATABASE_URL,
      max: 16,
    });
    const existing = await pool.query<{ count: number }>(
      "select pg_catalog.count(*)::integer as count from public.jobber_connections",
    );
    if (existing.rows[0].count !== 0) {
      throw new Error("Migration 044 concurrency rehearsal requires no Jobber connection");
    }
    // Applying the forward migration twice is part of its disposable-database
    // replay proof. The environment acknowledgement prevents accidental use.
    await pool.query(migration044);
    await pool.query(migration044);
  }, 30_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("serializes concurrent same-operation replay and a distinct first insert", async () => {
    const { actorId } = await createActor(pool);
    const sameOperationId = randomUUID();
    const distinctOperationId = randomUUID();
    const blocker = await pool.connect();
    const sameOne = await pool.connect();
    const sameTwo = await pool.connect();
    const distinct = await pool.connect();

    try {
      await blocker.query("begin");
      await blocker.query(
        "select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('jobber-connection:squeegeeking', 0))",
      );

      const sameOnePid = await backendPid(sameOne);
      const sameTwoPid = await backendPid(sameTwo);
      const distinctPid = await backendPid(distinct);
      const sameOneSave = sameOne.query<{ outcome: string }>(SAVE_SQL, saveValues({
        operationId: sameOperationId,
        actorId,
        suffix: "same",
      }));
      const sameTwoSave = sameTwo.query<{ outcome: string }>(SAVE_SQL, saveValues({
        operationId: sameOperationId,
        actorId,
        suffix: "same",
      }));
      const distinctSave = distinct.query<{ outcome: string }>(SAVE_SQL, saveValues({
        operationId: distinctOperationId,
        actorId,
        suffix: "distinct",
      }));

      await waitForLockBarrier(
        pool,
        [sameOnePid, sameTwoPid, distinctPid],
        "concurrent first-insert operations",
      );
      await blocker.query("commit");

      const [sameOneResult, sameTwoResult, distinctResult] = await Promise.all([
        sameOneSave,
        sameTwoSave,
        distinctSave,
      ]);
      const outcomes = [
        sameOneResult.rows[0].outcome,
        sameTwoResult.rows[0].outcome,
        distinctResult.rows[0].outcome,
      ].sort();
      expect(outcomes).toEqual(["connected", "reauthorized", "replay"]);
      expect(
        [sameOneResult.rows[0].outcome, sameTwoResult.rows[0].outcome].sort(),
      ).toContain("replay");

      const evidence = await pool.query<{
        token_generation: number;
        same_count: number;
        distinct_count: number;
      }>(
        `select connection.token_generation::integer,
          (select pg_catalog.count(*)::integer
             from public.jobber_connection_events
            where oauth_operation_id = $1) as same_count,
          (select pg_catalog.count(*)::integer
             from public.jobber_connection_events
            where oauth_operation_id = $2) as distinct_count
         from public.jobber_connections connection
         where connection.id = 'squeegeeking'`,
        [sameOperationId, distinctOperationId],
      );
      expect(evidence.rows[0]).toEqual({
        token_generation: 2,
        same_count: 1,
        distinct_count: 1,
      });
    } finally {
      await blocker.query("rollback").catch(() => {});
      blocker.release();
      sameOne.release();
      sameTwo.release();
      distinct.release();
    }
  }, 30_000);

  it.each<AuthorityMutation>(["deactivate", "delete", "role-change"])(
    "revalidates after an authority-first %s lock ordering",
    async (mutation) => {
      const { actorId } = await createActor(pool);
      const operationId = randomUUID();
      const authority = await pool.connect();
      const persister = await pool.connect();

      try {
        await authority.query("begin");
        await authority.query(authorityMutationSql(mutation), [actorId]);
        const persisterPid = await backendPid(persister);
        const persistence = persister.query<{ outcome: string }>(
          SAVE_SQL,
          saveValues({ operationId, actorId, suffix: `authority-first-${mutation}` }),
        );

        await waitForLockBarrier(
          pool,
          [persisterPid],
          `authority-first ${mutation}`,
        );
        await authority.query("commit");

        if (mutation === "role-change") {
          await expect(persistence).resolves.toMatchObject({
            rows: [{ outcome: "reauthorized" }],
          });
        } else {
          await expect(persistence).rejects.toThrow(
            "Jobber connection actor is not an active owner or operator",
          );
        }

        const evidence = await pool.query<{ count: number }>(
          `select pg_catalog.count(*)::integer as count
           from public.jobber_connection_events
           where oauth_operation_id = $1`,
          [operationId],
        );
        expect(evidence.rows[0].count).toBe(mutation === "role-change" ? 1 : 0);
      } finally {
        await authority.query("rollback").catch(() => {});
        authority.release();
        persister.release();
      }
    },
    30_000,
  );

  it.each<AuthorityMutation>(["deactivate", "delete", "role-change"])(
    "holds authority through a save-first %s lock ordering and then replays",
    async (mutation) => {
      const { actorId } = await createActor(pool);
      const operationId = randomUUID();
      const persister = await pool.connect();
      const authority = await pool.connect();

      try {
        await persister.query("begin");
        const persistence = await persister.query<{ outcome: string }>(
          SAVE_SQL,
          saveValues({ operationId, actorId, suffix: `save-first-${mutation}` }),
        );
        expect(persistence.rows[0].outcome).toBe("reauthorized");

        await authority.query("begin");
        const authorityPid = await backendPid(authority);
        const authorityMutation = authority.query(authorityMutationSql(mutation), [
          actorId,
        ]);
        await waitForLockBarrier(pool, [authorityPid], `save-first ${mutation}`);

        await persister.query("commit");
        await authorityMutation;
        await authority.query("commit");

        const replay = await pool.query<{ outcome: string }>(
          SAVE_SQL,
          saveValues({ operationId, actorId, suffix: `save-first-${mutation}` }),
        );
        expect(replay.rows[0].outcome).toBe("replay");

        const evidence = await pool.query<{ count: number }>(
          `select pg_catalog.count(*)::integer as count
           from public.jobber_connection_events
           where oauth_operation_id = $1`,
          [operationId],
        );
        expect(evidence.rows[0].count).toBe(1);
      } finally {
        await persister.query("rollback").catch(() => {});
        await authority.query("rollback").catch(() => {});
        persister.release();
        authority.release();
      }
    },
    30_000,
  );
});
