import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DISPOSABLE_ACK = "I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE";
const configured =
  process.env.PR1C_DISPOSABLE_DB_ACK === DISPOSABLE_ACK &&
  Boolean(process.env.PR1C_TEST_DATABASE_URL);
const integration = configured ? describe.sequential : describe.skip;

const migration036 = readFileSync(
  new URL("./migrations/036_hq_authority_input_closure.sql", import.meta.url),
  "utf8",
);
const migration037 = readFileSync(
  new URL("./migrations/037_stripe_setup_authorization.sql", import.meta.url),
  "utf8",
);
const migration042 = readFileSync(
  new URL(
    "./migrations/042_atomic_membership_activation_completion.sql",
    import.meta.url,
  ),
  "utf8",
);
const rehearsal = readFileSync(
  new URL(
    "./tests/042_atomic_membership_activation_completion.sql",
    import.meta.url,
  ),
  "utf8",
);
const fixtureHelpers = (
  rehearsal.match(
    /create temporary table activation_042_fixtures[\s\S]*?\n\$fixture\$;/,
  )?.[0] ?? ""
).replace("on commit drop", "on commit preserve rows");

interface FixtureRow {
  fixture_id: string;
  membership_id: string;
  presentation_id: string;
  agreement_id: string;
  homeowner_id: string;
  property_id: string;
  reconciliation_attempt_id: string;
  stripe_customer_id: string;
  stripe_setup_intent_id: string;
  stripe_payment_method_id: string;
}

let pool: Pool;

function activationQuery(fixture: FixtureRow) {
  return {
    text: `select public.activate_membership_after_stripe_setup(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false
    ) as result`,
    values: [
      fixture.membership_id,
      fixture.presentation_id,
      fixture.agreement_id,
      fixture.homeowner_id,
      fixture.property_id,
      "a".repeat(64),
      fixture.reconciliation_attempt_id,
      fixture.stripe_customer_id,
      fixture.stripe_setup_intent_id,
      fixture.stripe_payment_method_id,
    ],
  };
}

integration("migration 042 disposable atomic-completion rehearsal", () => {
  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.PR1C_TEST_DATABASE_URL,
      max: 8,
    });
    await pool.query(migration036);
    await pool.query(migration037);
    await pool.query(migration036);
    await pool.query(migration037);
    await pool.query(migration042);
    await pool.query(migration042);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("passes rollback, partial/mismatch, replay, month-end, and ACL SQL", async () => {
    await expect(pool.query(rehearsal)).resolves.toBeDefined();
  }, 120_000);

  it("serializes two genuinely queued activation calls to one exact set", async () => {
    expect(fixtureHelpers).not.toBe("");
    const setupClient = await pool.connect();
    let fixture: FixtureRow;
    try {
      await setupClient.query(fixtureHelpers);
      const { rows } = await setupClient.query<{ fixture_id: string }>(
        "select pg_temp.seed_activation_042() as fixture_id",
      );
      const fixtureResult = await setupClient.query<FixtureRow>(
        "select * from pg_temp.activation_042_fixtures where fixture_id = $1",
        [rows[0].fixture_id],
      );
      fixture = fixtureResult.rows[0];
    } finally {
      setupClient.release();
    }

    const blocker = await pool.connect();
    const first = await pool.connect();
    const second = await pool.connect();
    let outcomes: string[] = [];
    try {
      await blocker.query("begin");
      await blocker.query(
        "select id from public.memberships where id = $1 for update",
        [fixture.membership_id],
      );
      const firstActivation = first.query(activationQuery(fixture));
      const secondActivation = second.query(activationQuery(fixture));
      await new Promise((resolve) => setTimeout(resolve, 50));
      await blocker.query("commit");
      const results = await Promise.all([firstActivation, secondActivation]);
      outcomes = results.map((result) => result.rows[0].result.outcome);
    } finally {
      await blocker.query("rollback").catch(() => {});
      blocker.release();
      first.release();
      second.release();
    }

    expect(new Set(outcomes)).toEqual(new Set(["activated", "replay"]));
    const { rows: counts } = await pool.query(
      `select
        (select count(*)::int from public.membership_payment_setup_events
          where membership_id = $1) as evidence_count,
        (select count(*)::int from public.website_membership_sales
          where membership_id = $1) as sale_count,
        (select count(*)::int from public.obligations
          where membership_id = $1 and membership_year = 1) as obligation_count,
        (select count(*)::int
          from public.obligation_events event
          join public.obligations obligation on obligation.id = event.obligation_id
          where obligation.membership_id = $1
            and obligation.membership_year = 1
            and event.reason = 'membership_activated') as activation_event_count`,
      [fixture.membership_id],
    );
    expect(counts[0]).toEqual({
      evidence_count: 1,
      sale_count: 1,
      obligation_count: 4,
      activation_event_count: 4,
    });
  }, 120_000);
});
