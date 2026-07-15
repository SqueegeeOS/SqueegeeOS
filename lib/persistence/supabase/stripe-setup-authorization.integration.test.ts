import { readFileSync } from "node:fs";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DISPOSABLE_ACK = "I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE";
const configured =
  process.env.PR1C_DISPOSABLE_DB_ACK === DISPOSABLE_ACK &&
  Boolean(process.env.PR1C_TEST_DATABASE_URL);
const integration = configured ? describe : describe.skip;
const AUTHORITY_SHA256 = "a".repeat(64);
const SIGNATURE_SHA256 = "b".repeat(64);
const STRIPE_TABLES = [
  "membership_payment_setup_events",
  "membership_stripe_setup_reconciliation_attempts",
  "membership_stripe_setup_reconciliation_events",
] as const;
const EXPECTED_COLUMN_SIGNATURES = {
  membership_payment_setup_events: [
    "id:uuid:NO:gen_random_uuid()", "reconciliation_attempt_id:uuid:NO:",
    "membership_id:uuid:NO:", "presentation_id:uuid:NO:",
    "agreement_id:uuid:NO:", "homeowner_id:uuid:NO:", "property_id:uuid:NO:",
    "sales_tier:text:NO:", "visit_price:numeric(10,2):NO:",
    "visits_per_year:smallint:NO:", "presentation_authority_sha256:text:NO:",
    "enrollment_savings:numeric(10,2):NO:", "stripe_customer_id:text:NO:",
    "stripe_setup_intent_id:text:NO:", "stripe_payment_method_id:text:NO:",
    "stripe_livemode:boolean:NO:", "stripe_setup_intent_status:text:NO:",
    "stripe_metadata:jsonb:NO:",
    "payment_setup_completed_at:timestamp with time zone:NO:",
    "occurred_at:timestamp with time zone:NO:now()",
  ],
  membership_stripe_setup_reconciliation_attempts: [
    "id:uuid:NO:gen_random_uuid()", "membership_id:uuid:NO:",
    "presentation_id:uuid:NO:", "agreement_id:uuid:NO:",
    "homeowner_id:uuid:NO:", "property_id:uuid:NO:",
    "capability_kind:text:NO:", "sales_tier:text:NO:",
    "visit_price:numeric(10,2):NO:", "visits_per_year:smallint:NO:",
    "enrollment_savings:numeric(10,2):NO:",
    "presentation_authority_sha256:text:NO:",
    "customer_idempotency_key:text:NO:", "setup_intent_idempotency_key:text:NO:",
    "operation_phase:text:NO:'before_provider'::text",
    "operation_status:text:NO:'reserved'::text",
    "created_at:timestamp with time zone:NO:now()",
  ],
  membership_stripe_setup_reconciliation_events: [
    "id:uuid:NO:gen_random_uuid()", "attempt_id:uuid:NO:",
    "event_key:text:NO:", "operation_phase:text:NO:",
    "operation_status:text:NO:", "stripe_customer_id:text:YES:",
    "stripe_setup_intent_id:text:YES:", "outcome:text:YES:",
    "error_code:text:YES:", "occurred_at:timestamp with time zone:NO:now()",
  ],
} as const;

const migration036 = readFileSync(
  new URL("./migrations/036_hq_authority_input_closure.sql", import.meta.url),
  "utf8",
);
const migration037 = readFileSync(
  new URL("./migrations/037_stripe_setup_authorization.sql", import.meta.url),
  "utf8",
);

const constraintGuard =
  migration037.match(
    /with expected\(table_name, constraint_name, canonical_definition\) as \(values([\s\S]*?)\n  \), actual as/,
  )?.[1] ?? "";
const EXPECTED_CONSTRAINT_DEFINITIONS = Array.from(
  constraintGuard.matchAll(/\('([^']+)', '([^']+)', '((?:''|[^'])*)'\)/g),
  (match) => ({
    table_name: match[1],
    conname: match[2],
    canonical_definition: match[3].replaceAll("''", "'"),
  }),
).sort((left, right) =>
  `${left.table_name}.${left.conname}`.localeCompare(
    `${right.table_name}.${right.conname}`,
  ),
);

interface Fixture {
  membershipId: string;
  presentationId: string;
  agreementId: string;
  homeownerId: string;
  propertyId: string;
}

interface PreparedFixture extends Fixture {
  reconciliationAttemptId: string;
}

let pool: Pool;

async function createFixture(client: Pool | PoolClient): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const presentationId = crypto.randomUUID();
  const homeownerId = crypto.randomUUID();
  const propertyId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const signingAttemptId = crypto.randomUUID();
  const agreementId = crypto.randomUUID();
  const quoteSnapshot = {
    sqft: 2500,
    frequency: "quarterly",
    includeInterior: false,
    twoStory: false,
    includeScreens: false,
    windowCareVisitPrice: 225,
    frequencyLabel: "Quarterly",
    exteriorAddOnQuote: {
      lineItems: [],
      subtotal: 0,
      listSubtotal: 0,
      memberDiscountPercent: null,
      memberSavings: 0,
    },
    totalEstimate: 225,
    authority: "atlas_pricing_engine_v1",
    pricingSettingsUpdatedAt: "2026-07-14T10:00:00.000Z",
    tierVisitPrices: { biannual: 320, quarterly: 225 },
    tierEnrollmentSavings: { biannual: 15, quarterly: 25 },
    exteriorAddOnSelections: [],
  };

  await client.query(
    `insert into public.presentations (
       id, client_name, client_address, client_email, home_sqft, tier,
       quote_snapshot, authority_sha256, enrollment_savings, status
     ) values ($1, $2, $3, $4, 2500, 'quarterly', $5::jsonb, $6, 25, 'draft')`,
    [
      presentationId,
      `PR1C ${suffix}`,
      `${suffix.slice(0, 8)} Race Way, Chico, CA 95928`,
      `pr1c-${suffix}@example.invalid`,
      JSON.stringify(quoteSnapshot),
      AUTHORITY_SHA256,
    ],
  );
  await client.query(
    `insert into public.homeowners (
       id, slug, full_name, first_name, email, source_presentation_id
     ) values ($1, $2, $3, 'PR1C', $4, $5)`,
    [
      homeownerId,
      `pr1c-${suffix}`,
      `PR1C ${suffix}`,
      `pr1c-${suffix}@example.invalid`,
      presentationId,
    ],
  );
  await client.query(
    `insert into public.properties (
       id, homeowner_id, slug, name, address, city, state, zip, type,
       source_presentation_id
     ) values ($1, $2, $3, 'PR1C Disposable', $4, 'Chico', 'CA', '95928',
       'Residence', $5)`,
    [
      propertyId,
      homeownerId,
      `pr1c-${suffix}`,
      `${suffix.slice(0, 8)} Race Way`,
      presentationId,
    ],
  );
  await client.query(
    `insert into public.memberships (
       id, homeowner_id, property_id, plan_id, plan_name, price_display,
       billing_period, status, presentation_id, sales_tier, visit_price,
       visits_per_year
     ) values ($1, $2, $3, 'preferred', 'Quarterly', '$225/visit',
       'per_visit', 'pending_payment', $4, 'quarterly', 225, 4)`,
    [membershipId, homeownerId, propertyId, presentationId],
  );
  await client.query(
    `insert into public.presentation_signing_attempts (
       presentation_id, attempt_id, agreement_tier, signature_sha256,
       presentation_authority_sha256, status
     ) values ($1, $2, 'quarterly', $3, $4, 'pending')`,
    [presentationId, signingAttemptId, SIGNATURE_SHA256, AUTHORITY_SHA256],
  );
  await client.query(
    `insert into public.signed_agreements (
       id, homeowner_id, property_id, membership_id, presentation_id,
       homeowner_slug, property_slug, homeowner_name, plan_id, plan_name,
       signature_method, signer_name, signed_at, status, signing_attempt_id,
       signing_evidence_sha256, agreement_tier
     ) values ($1, $2, $3, $4, $5, $6, $6, 'PR1C Member', 'preferred',
       'Quarterly', 'drawn', 'PR1C Member', now(), 'complete', $7, $8,
       'quarterly')`,
    [
      agreementId,
      homeownerId,
      propertyId,
      membershipId,
      presentationId,
      `pr1c-${suffix}`,
      signingAttemptId,
      SIGNATURE_SHA256,
    ],
  );
  await client.query(
    `update public.memberships set agreement_id = $2 where id = $1`,
    [membershipId, agreementId],
  );
  await client.query(
    `update public.presentations
     set status = 'signed', signed_at = now(), agreement_id = $2,
         homeowner_id = $3, property_id = $4, membership_id = $1,
         onboarding_status = 'pending_payment'
     where id = $5`,
    [membershipId, agreementId, homeownerId, propertyId, presentationId],
  );
  await client.query(
    `update public.presentation_signing_attempts
     set status = 'complete', agreement_id = $2 where presentation_id = $1`,
    [presentationId, agreementId],
  );

  return {
    membershipId,
    presentationId,
    agreementId,
    homeownerId,
    propertyId,
  };
}

async function reserve(fixture: Fixture): Promise<PreparedFixture> {
  const { rows } = await pool.query(
    `select public.reserve_membership_stripe_setup_reconciliation(
       $1, $2, $3, $4, $5, $6, 'presentation'
     ) as result`,
    [
      fixture.membershipId,
      fixture.presentationId,
      fixture.agreementId,
      fixture.homeownerId,
      fixture.propertyId,
      AUTHORITY_SHA256,
    ],
  );
  expect(rows[0].result.outcome).toMatch(/reserved|replay/);
  return {
    ...fixture,
    reconciliationAttemptId: rows[0].result.attempt.id as string,
  };
}

async function observeProvider(
  fixture: PreparedFixture,
  customerId: string,
  setupIntentId: string,
) {
  for (const [eventKey, phase, setupId] of [
    ["customer_created", "customer", null],
    ["setup_intent_created", "setup_intent", setupIntentId],
  ] as const) {
    const result = await appendEvent(fixture, {
      eventKey,
      phase,
      status: "created",
      customerId,
      setupIntentId: setupId,
      outcome: "provider_resolved",
    });
    expect(result.outcome).toMatch(/appended|replay/);
  }
}

async function appendEvent(
  fixture: PreparedFixture,
  event: {
    eventKey: string;
    phase: string;
    status: string;
    customerId?: string | null;
    setupIntentId?: string | null;
    outcome?: string | null;
    errorCode?: string | null;
  },
) {
  const { rows } = await pool.query(
    `select public.append_membership_stripe_setup_reconciliation_event(
       $1, $2, $3, $4, $5, $6, $7, $8
     ) as result`,
    [
      fixture.reconciliationAttemptId,
      event.eventKey,
      event.phase,
      event.status,
      event.customerId ?? null,
      event.setupIntentId ?? null,
      event.outcome ?? null,
      event.errorCode ?? null,
    ],
  );
  return rows[0].result as Record<string, unknown>;
}

async function prepare(
  fixture: Fixture,
  customerId: string,
  setupIntentId: string,
) {
  const prepared = await reserve(fixture);
  await observeProvider(prepared, customerId, setupIntentId);
  return prepared;
}

async function claim(
  fixture: PreparedFixture,
  customerId: string,
  setupIntentId: string,
  client: Pool | PoolClient = pool,
) {
  const { rows } = await client.query(
    `select public.claim_membership_stripe_setup(
       $1, $2, $3, $4, $5, $6, $7, $8, $9
     ) as result`,
    [
      fixture.membershipId,
      fixture.presentationId,
      fixture.agreementId,
      fixture.homeownerId,
      fixture.propertyId,
      AUTHORITY_SHA256,
      fixture.reconciliationAttemptId,
      customerId,
      setupIntentId,
    ],
  );
  return rows[0].result as Record<string, unknown>;
}

async function activate(
  fixture: PreparedFixture,
  customerId: string,
  setupIntentId: string,
  paymentMethodId: string,
  client: Pool | PoolClient = pool,
) {
  const { rows } = await client.query(
    `select public.activate_membership_after_stripe_setup(
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false
     ) as result`,
    [
      fixture.membershipId,
      fixture.presentationId,
      fixture.agreementId,
      fixture.homeownerId,
      fixture.propertyId,
      AUTHORITY_SHA256,
      fixture.reconciliationAttemptId,
      customerId,
      setupIntentId,
      paymentMethodId,
    ],
  );
  return rows[0].result as Record<string, unknown>;
}

integration("migration 037 disposable locked-activation rehearsal", () => {
  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.PR1C_TEST_DATABASE_URL,
      max: 8,
    });
    await pool.query(migration036);
    await pool.query(migration037);
    await pool.query(migration036);
    await pool.query(migration037);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("has exact role ACLs, function security modes, constraints, and trigger", async () => {
    const { rows: aclRows } = await pool.query(`
      select
        has_table_privilege('anon', 'public.membership_payment_setup_events', 'SELECT') as anon_select,
        has_table_privilege('authenticated', 'public.membership_payment_setup_events', 'SELECT') as authenticated_select,
        has_table_privilege('service_role', 'public.membership_payment_setup_events', 'SELECT') as service_select,
        has_table_privilege('service_role', 'public.membership_payment_setup_events', 'INSERT') as service_insert,
        has_function_privilege('anon', 'public.claim_membership_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text)', 'EXECUTE') as anon_claim,
        has_function_privilege('authenticated', 'public.activate_membership_after_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,boolean)', 'EXECUTE') as authenticated_activate,
        has_function_privilege('service_role', 'public.claim_membership_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text)', 'EXECUTE') as service_claim,
        has_function_privilege('service_role', 'public.activate_membership_after_stripe_setup(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,boolean)', 'EXECUTE') as service_activate
    `);
    expect(aclRows[0]).toEqual({
      anon_select: false,
      authenticated_select: false,
      service_select: true,
      service_insert: false,
      anon_claim: false,
      authenticated_activate: false,
      service_claim: true,
      service_activate: true,
    });
    const { rows: tablePrivileges } = await pool.query(`
      select grantee, table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = any($1::text[])
        and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
      order by grantee, table_name, privilege_type
    `, [STRIPE_TABLES]);
    expect(tablePrivileges).toEqual([
      { grantee: "service_role", table_name: STRIPE_TABLES[0], privilege_type: "SELECT" },
      { grantee: "service_role", table_name: STRIPE_TABLES[1], privilege_type: "SELECT" },
      { grantee: "service_role", table_name: STRIPE_TABLES[2], privilege_type: "SELECT" },
    ]);
    const { rows: functionPrivileges } = await pool.query(`
      select grantee, routine_name, privilege_type
      from information_schema.routine_privileges
      where specific_schema = 'public'
        and routine_name in (
          'claim_membership_stripe_setup',
          'activate_membership_after_stripe_setup',
          'reserve_membership_stripe_setup_reconciliation',
          'append_membership_stripe_setup_reconciliation_event',
          'reject_membership_payment_setup_event_change'
        )
        and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
      order by grantee, routine_name, privilege_type
    `);
    expect(functionPrivileges).toEqual([
      {
        grantee: "service_role",
        routine_name: "activate_membership_after_stripe_setup",
        privilege_type: "EXECUTE",
      },
      {
        grantee: "service_role",
        routine_name: "append_membership_stripe_setup_reconciliation_event",
        privilege_type: "EXECUTE",
      },
      {
        grantee: "service_role",
        routine_name: "claim_membership_stripe_setup",
        privilege_type: "EXECUTE",
      },
      {
        grantee: "service_role",
        routine_name: "reject_membership_payment_setup_event_change",
        privilege_type: "EXECUTE",
      },
      {
        grantee: "service_role",
        routine_name: "reserve_membership_stripe_setup_reconciliation",
        privilege_type: "EXECUTE",
      },
    ]);

    const { rows: functions } = await pool.query(`
      select proname, pg_catalog.oidvectortypes(proargtypes) as arguments,
             prosecdef, proconfig,
             md5(btrim(regexp_replace(prosrc, '[[:space:]]+', ' ', 'g'))) as body_md5
      from pg_catalog.pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in (
          'claim_membership_stripe_setup',
          'activate_membership_after_stripe_setup',
          'reserve_membership_stripe_setup_reconciliation',
          'append_membership_stripe_setup_reconciliation_event',
          'reject_membership_payment_setup_event_change'
        )
      order by proname
    `);
    expect(functions).toHaveLength(5);
    expect(functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          proname: "claim_membership_stripe_setup",
          arguments: "uuid, uuid, uuid, uuid, uuid, text, uuid, text, text",
          prosecdef: false,
          proconfig: ["search_path=pg_catalog"],
          body_md5: "20a8650237fe48c8deb5e7a7ad86716a",
        }),
        expect.objectContaining({
          proname: "reject_membership_payment_setup_event_change",
          arguments: "",
          prosecdef: false,
          proconfig: ["search_path=pg_catalog"],
          body_md5: "59f2ded13ab83a4e618d22b9a2b189e7",
        }),
        expect.objectContaining({
          proname: "activate_membership_after_stripe_setup",
          arguments:
            "uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, boolean",
          prosecdef: true,
          proconfig: ["search_path=pg_catalog"],
          body_md5: "e463bd2e8f6fadbf3a2f3f2a150cce62",
        }),
        expect.objectContaining({
          proname: "reserve_membership_stripe_setup_reconciliation",
          arguments: "uuid, uuid, uuid, uuid, uuid, text, text",
          prosecdef: true,
          proconfig: ["search_path=pg_catalog"],
          body_md5: "d5d7354afaa5c16c76ad0087920ff2f8",
        }),
        expect.objectContaining({
          proname: "append_membership_stripe_setup_reconciliation_event",
          arguments: "uuid, text, text, text, text, text, text, text",
          prosecdef: true,
          proconfig: ["search_path=pg_catalog"],
          body_md5: "d82f6ce2aa2aead47e6818227f739020",
        }),
      ]),
    );

    const { rows: columnRows } = await pool.query(`
      select table_name,
             column_name || ':' ||
             case when data_type = 'numeric'
               then data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
               else data_type end || ':' || is_nullable || ':' ||
             coalesce(column_default, '') as signature
      from information_schema.columns
      where table_schema = 'public' and table_name = any($1::text[])
      order by table_name, ordinal_position
    `, [STRIPE_TABLES]);
    for (const table of STRIPE_TABLES) {
      expect(
        columnRows
          .filter((row) => row.table_name === table)
          .map((row) => row.signature),
      ).toEqual(EXPECTED_COLUMN_SIGNATURES[table]);
    }

    const { rows: constraints } = await pool.query(`
      select c.relname as table_name, k.conname,
             pg_get_constraintdef(k.oid, false) as definition,
             regexp_replace(
               lower(pg_get_constraintdef(k.oid, false)),
               '[[:space:]]+', '', 'g'
             ) as canonical_definition
      from pg_catalog.pg_constraint k
      join pg_catalog.pg_class c on c.oid = k.conrelid
      where c.oid = any($1::regclass[])
      order by c.relname, k.conname
    `, [STRIPE_TABLES.map((table) => `public.${table}`)]);
    expect(
      constraints.map(({ table_name, conname, canonical_definition }) => ({
        table_name,
        constraint_name: conname,
        canonical_definition,
      })),
    ).toEqual(
      EXPECTED_CONSTRAINT_DEFINITIONS,
    );
    const definitions = constraints.map(
      (row) => `${row.conname}: ${row.definition}`,
    );
    for (const fragment of [
      "membership_id_key: UNIQUE (membership_id)",
      "stripe_customer_id_key: UNIQUE (stripe_customer_id)",
      "stripe_setup_intent_id_key: UNIQUE (stripe_setup_intent_id)",
      "membership_payment_setup_events_sales_tier_check",
      "membership_payment_setup_events_visit_price_check",
      "membership_payment_setup_events_visits_per_year_check",
      "membership_payment_setup_events_authority_sha256_check",
      "membership_payment_setup_events_enrollment_savings_check",
      "membership_payment_setup_events_reconciliation_attempt_id_key: UNIQUE (reconciliation_attempt_id)",
      "membership_payment_setup_events_reconciliation_attempt_id_fkey: FOREIGN KEY (reconciliation_attempt_id) REFERENCES membership_stripe_setup_reconciliation_attempts(id) ON DELETE RESTRICT",
      "membership_payment_setup_events_membership_id_fkey: FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE RESTRICT",
      "membership_payment_setup_events_presentation_id_fkey: FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE RESTRICT",
      "membership_payment_setup_events_agreement_id_fkey: FOREIGN KEY (agreement_id) REFERENCES signed_agreements(id) ON DELETE RESTRICT",
      "membership_payment_setup_events_homeowner_id_fkey: FOREIGN KEY (homeowner_id) REFERENCES homeowners(id) ON DELETE RESTRICT",
      "membership_payment_setup_events_property_id_fkey: FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT",
      "membership_stripe_setup_reconciliation_attempts_pkey: PRIMARY KEY (id)",
      "membership_stripe_setup_reconciliation_attempts_membership_id_key: UNIQUE (membership_id)",
      "membership_stripe_setup_reconciliation_attempts_customer_idempotency_key_key: UNIQUE (customer_idempotency_key)",
      "membership_stripe_setup_reconciliation_attempts_setup_intent_idempotency_key_key: UNIQUE (setup_intent_idempotency_key)",
      "membership_stripe_setup_reconciliation_attempts_enrollment_savings_check",
      "membership_stripe_setup_reconciliation_events_pkey: PRIMARY KEY (id)",
      "membership_stripe_setup_reconciliation_events_attempt_id_event_key_key: UNIQUE (attempt_id, event_key)",
      "membership_stripe_setup_reconciliation_events_attempt_id_fkey: FOREIGN KEY (attempt_id) REFERENCES membership_stripe_setup_reconciliation_attempts(id) ON DELETE RESTRICT",
      "membership_stripe_setup_reconciliation_events_error_state_check",
    ]) {
      expect(definitions.some((definition) => definition.includes(fragment))).toBe(
        true,
      );
    }

    const { rows: triggers } = await pool.query(`
      select c.relname as table_name, t.tgname as trigger_name,
             pg_get_triggerdef(t.oid, false) as definition
      from pg_catalog.pg_trigger t
      join pg_catalog.pg_class c on c.oid = t.tgrelid
      where c.oid = any($1::regclass[]) and not t.tgisinternal
      order by c.relname, t.tgname
    `, [STRIPE_TABLES.map((table) => `public.${table}`)]);
    expect(triggers).toEqual(
      STRIPE_TABLES.map((table) => ({
        table_name: table,
        trigger_name: `${table}_immutable`,
        definition: `CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.reject_membership_payment_setup_event_change()`,
      })),
    );
  });

  it("rejects a malformed partial reconciliation schema on rerun", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `alter table public.membership_stripe_setup_reconciliation_attempts
         alter column operation_status drop not null`,
      );
      await expect(client.query(migration037)).rejects.toThrow(
        "Malformed PR1c reconciliation schema requires review",
      );
    } finally {
      await client.query("rollback").catch(() => {});
      client.release();
    }
  });

  it("rejects a weakened same-name constraint on rerun", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(`
        alter table public.membership_stripe_setup_reconciliation_attempts
          drop constraint membership_stripe_setup_reconciliation_attempts_enrollment_savings_check;
        alter table public.membership_stripe_setup_reconciliation_attempts
          add constraint membership_stripe_setup_reconciliation_attempts_enrollment_savings_check
          check (enrollment_savings >= -1000)
      `);
      await expect(client.query(migration037)).rejects.toThrow(
        "Malformed PR1c constraint definitions require review",
      );
    } finally {
      await client.query("rollback").catch(() => {});
      client.release();
    }
  });

  it("rejects a weakened same-signature function on rerun", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(`
        create or replace function public.append_membership_stripe_setup_reconciliation_event(
          p_attempt_id uuid,
          p_event_key text,
          p_operation_phase text,
          p_operation_status text,
          p_stripe_customer_id text,
          p_stripe_setup_intent_id text,
          p_outcome text,
          p_error_code text
        ) returns jsonb language plpgsql security definer
        set search_path = pg_catalog as $$
        begin
          return jsonb_build_object('outcome', 'appended');
        end;
        $$
      `);
      await expect(client.query(migration037)).rejects.toThrow(
        "Malformed PR1c function definitions require review",
      );
    } finally {
      await client.query("rollback").catch(() => {});
      client.release();
    }
  });

  it("replays identical immutable setup and failure facts without conflict", async () => {
    const rawFixture = await createFixture(pool);
    const fixture = await reserve(rawFixture);
    const customerId = `cus_${crypto.randomUUID().replaceAll("-", "")}`;
    const setupIntentId = `seti_${crypto.randomUUID().replaceAll("-", "")}`;
    const customerCreated = {
      eventKey: "customer_created",
      phase: "customer",
      status: "created",
      customerId,
      outcome: "provider_resolved",
    };
    const setupIntentCreated = {
      eventKey: "setup_intent_created",
      phase: "setup_intent",
      status: "created",
      customerId,
      setupIntentId,
      outcome: "provider_resolved",
    };
    const repeatedFailure = {
      eventKey: "failure:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      phase: "claim",
      status: "failed",
      customerId,
      setupIntentId,
      outcome: "failed",
      errorCode: "setup_intent_claim_failed",
    };

    await expect(appendEvent(fixture, customerCreated)).resolves.toMatchObject({
      outcome: "appended",
    });
    await expect(appendEvent(fixture, customerCreated)).resolves.toMatchObject({
      outcome: "replay",
    });
    await expect(appendEvent(fixture, setupIntentCreated)).resolves.toMatchObject({
      outcome: "appended",
    });
    await expect(appendEvent(fixture, setupIntentCreated)).resolves.toMatchObject({
      outcome: "replay",
    });
    await expect(appendEvent(fixture, repeatedFailure)).resolves.toMatchObject({
      outcome: "appended",
    });
    await expect(appendEvent(fixture, repeatedFailure)).resolves.toMatchObject({
      outcome: "replay",
    });
    await expect(
      appendEvent(fixture, {
        ...repeatedFailure,
        eventKey: "failure:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        errorCode: "ready_reconciliation_write_failed",
      }),
    ).resolves.toMatchObject({ outcome: "appended" });

    const { rows } = await pool.query(
      `select event_key, operation_status, error_code
       from public.membership_stripe_setup_reconciliation_events
       where attempt_id = $1 order by event_key`,
      [fixture.reconciliationAttemptId],
    );
    expect(rows).toHaveLength(4);
  });

  it("simultaneously races two memberships for one provider binding", async () => {
    const firstFixture = await createFixture(pool);
    const secondFixture = await createFixture(pool);
    const customerId = `cus_${crypto.randomUUID().replaceAll("-", "")}`;
    const setupIntentId = `seti_${crypto.randomUUID().replaceAll("-", "")}`;
    const paymentMethodId = `pm_${crypto.randomUUID().replaceAll("-", "")}`;
    const first = await prepare(firstFixture, customerId, setupIntentId);
    const second = await prepare(secondFixture, customerId, setupIntentId);

    const blocker = await pool.connect();
    const firstClient = await pool.connect();
    const secondClient = await pool.connect();
    let claims: Record<string, unknown>[] = [];
    try {
      await blocker.query(
        "select pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended($1, 0))",
        [customerId],
      );
      const firstClaim = claim(first, customerId, setupIntentId, firstClient);
      const secondClaim = claim(second, customerId, setupIntentId, secondClient);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await blocker.query(
        "select pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended($1, 0))",
        [customerId],
      );
      claims = await Promise.all([firstClaim, secondClaim]);
    } finally {
      await blocker.query(
        "select pg_catalog.pg_advisory_unlock_all()",
      ).catch(() => {});
      blocker.release();
      firstClient.release();
      secondClient.release();
    }
    expect(claims.filter((result) => result.outcome === "claimed")).toHaveLength(1);
    expect(claims.filter((result) => result.outcome === "held")).toHaveLength(1);
    const winner = claims[0].outcome === "claimed" ? first : second;
    const loser = winner === first ? second : first;

    const winnerClient = await pool.connect();
    const loserClient = await pool.connect();
    let activations: Record<string, unknown>[] = [];
    try {
      activations = await Promise.all([
        activate(winner, customerId, setupIntentId, paymentMethodId, winnerClient),
        activate(loser, customerId, setupIntentId, paymentMethodId, loserClient),
      ]);
    } finally {
      winnerClient.release();
      loserClient.release();
    }
    expect(activations[0]).toMatchObject({
      outcome: "activated",
      membership_id: winner.membershipId,
      sales_tier: "quarterly",
      visit_price: 225,
      visits_per_year: 4,
      presentation_authority_sha256: AUTHORITY_SHA256,
    });
    expect(activations[1]).toMatchObject({ outcome: "held" });

    const { rows: state } = await pool.query(
      `select
         m.id, m.status, m.stripe_customer_id, m.stripe_setup_intent_id,
         m.stripe_payment_method_id, m.started_at,
         m.payment_setup_completed_at, m.membership_enrollment_savings,
         p.onboarding_status,
         (select count(*)::int from public.membership_payment_setup_events e where e.membership_id = m.id) as evidence_count,
         (select count(*)::int from public.website_membership_sales s where s.membership_id = m.id) as sale_count,
         (select count(*)::int from public.obligations o where o.membership_id = m.id) as obligation_count
       from public.memberships m
       join public.presentations p on p.id = m.presentation_id
       where m.id = any($1::uuid[])
       order by m.id`,
      [[winner.membershipId, loser.membershipId]],
    );
    const winnerState = state.find((row) => row.id === winner.membershipId);
    const loserState = state.find((row) => row.id === loser.membershipId);
    expect(winnerState).toMatchObject({
      status: "active",
      evidence_count: 1,
      sale_count: 0,
      obligation_count: 0,
    });
    expect(loserState).toMatchObject({
      status: "pending_payment",
      stripe_customer_id: null,
      stripe_setup_intent_id: null,
      payment_setup_completed_at: null,
      stripe_payment_method_id: null,
      started_at: null,
      membership_enrollment_savings: null,
      onboarding_status: "pending_payment",
      evidence_count: 0,
      sale_count: 0,
      obligation_count: 0,
    });
    await expect(
      pool.query(
        `update public.membership_payment_setup_events
         set visit_price = visit_price where membership_id = $1`,
        [winner.membershipId],
      ),
    ).rejects.toThrow("append-only and immutable");
    await expect(
      pool.query(
        `update public.membership_stripe_setup_reconciliation_attempts
         set operation_status = operation_status where id = $1`,
        [winner.reconciliationAttemptId],
      ),
    ).rejects.toThrow("append-only and immutable");
    await expect(
      pool.query(
        `delete from public.membership_stripe_setup_reconciliation_events
         where attempt_id = $1`,
        [winner.reconciliationAttemptId],
      ),
    ).rejects.toThrow("append-only and immutable");
  });

  it("serializes exact same-membership claim and activation replays", async () => {
    const rawFixture = await createFixture(pool);
    const customerId = `cus_${crypto.randomUUID().replaceAll("-", "")}`;
    const setupIntentId = `seti_${crypto.randomUUID().replaceAll("-", "")}`;
    const paymentMethodId = `pm_${crypto.randomUUID().replaceAll("-", "")}`;
    const fixture = await prepare(rawFixture, customerId, setupIntentId);

    const claims = await Promise.all([
      claim(fixture, customerId, setupIntentId),
      claim(fixture, customerId, setupIntentId),
    ]);
    expect(claims.map((result) => result.outcome)).toEqual(["claimed", "claimed"]);

    const activations = await Promise.all([
      activate(fixture, customerId, setupIntentId, paymentMethodId),
      activate(fixture, customerId, setupIntentId, paymentMethodId),
    ]);
    expect(new Set(activations.map((result) => result.outcome))).toEqual(
      new Set(["activated", "replay"]),
    );
    const { rows: evidence } = await pool.query(
      `select membership_id, reconciliation_attempt_id
       from public.membership_payment_setup_events where membership_id = $1`,
      [fixture.membershipId],
    );
    expect(evidence).toEqual([
      {
        membership_id: fixture.membershipId,
        reconciliation_attempt_id: fixture.reconciliationAttemptId,
      },
    ]);
  });

  it("holds a queued activation after a locked-term race with no downstream writes", async () => {
    const rawFixture = await createFixture(pool);
    const customerId = `cus_${crypto.randomUUID().replaceAll("-", "")}`;
    const setupIntentId = `seti_${crypto.randomUUID().replaceAll("-", "")}`;
    const paymentMethodId = `pm_${crypto.randomUUID().replaceAll("-", "")}`;
    const fixture = await prepare(rawFixture, customerId, setupIntentId);
    await claim(fixture, customerId, setupIntentId);

    const locker = await pool.connect();
    try {
      await locker.query("begin");
      await locker.query(
        `select id from public.memberships where id = $1 for update`,
        [fixture.membershipId],
      );
      const queuedActivation = activate(
        fixture,
        customerId,
        setupIntentId,
        paymentMethodId,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      await locker.query(
        `update public.memberships set visit_price = 226 where id = $1`,
        [fixture.membershipId],
      );
      await locker.query("commit");

      await expect(queuedActivation).resolves.toMatchObject({
        outcome: "held",
        reason: "signed_pricing_authority_changed",
      });
    } finally {
      await locker.query("rollback").catch(() => {});
      locker.release();
    }

    const { rows } = await pool.query(
      `select
         m.status,
         m.payment_setup_completed_at,
         m.stripe_payment_method_id,
         m.membership_enrollment_savings,
         p.onboarding_status,
         (select count(*)::int from public.membership_payment_setup_events e where e.membership_id = m.id) as evidence_count,
         (select count(*)::int from public.website_membership_sales s where s.membership_id = m.id) as sale_count,
         (select count(*)::int from public.obligations o where o.membership_id = m.id) as obligation_count
       from public.memberships m
       join public.presentations p on p.id = m.presentation_id
       where m.id = $1`,
      [fixture.membershipId],
    );
    expect(rows[0]).toMatchObject({
      status: "pending_payment",
      payment_setup_completed_at: null,
      stripe_payment_method_id: null,
      membership_enrollment_savings: null,
      onboarding_status: "pending_payment",
      evidence_count: 0,
      sale_count: 0,
      obligation_count: 0,
    });
  });
});
