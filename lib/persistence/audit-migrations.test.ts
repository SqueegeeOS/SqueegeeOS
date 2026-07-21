import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertMigration043RequiredClauses,
  hasExactAtomicCompletionNonOwnerAcl,
  hasExactAtomicCompletionTableAcl,
  hasExactAuthorityFunctionAcl,
  hasExactVisitCompletionFunctionAcl,
  hasExactVisitCompletionConstraints,
  hasExactVisitCompletionTableAcl,
  expectedVisitCompletionConstraintInventory,
  isExactAtomicCompletionTriggerSet,
  isExactJobberConnectionEventImmutabilityTrigger,
  isExactJobberOauthFunctionDefinition,
  isExactJobberOauthOperationColumn,
  isExactJobberOauthOperationIndex,
  isExactSignedAgreementImmutabilityTrigger,
  isExactVisitCompletionTriggerSet,
} from "../../scripts/audit-migrations.mjs";

const expectedFunctionNames = [
  "claim_presentation_signing_attempt",
  "finalize_presentation_signing_attempt",
  "reject_completed_signed_agreement_mutation",
  "save_hq_home_care_plan",
];

function exactAclRows() {
  return expectedFunctionNames.flatMap((routineName, index) => {
    const functionOid = String(1000 + index);
    return [
      {
        function_oid: functionOid,
        routine_name: routineName,
        owner_oid: "10",
        owner_name: "postgres",
        grantee_oid: "10",
        grantee_name: "postgres",
        is_owner: true,
        privilege_type: "EXECUTE",
        is_grantable: false,
      },
      {
        function_oid: functionOid,
        routine_name: routineName,
        owner_oid: "10",
        owner_name: "postgres",
        grantee_oid: "20",
        grantee_name: "service_role",
        is_owner: false,
        privilege_type: "EXECUTE",
        is_grantable: false,
      },
    ];
  });
}

const expectedFunctionOid = "4242";
const exactTriggerRow = {
  table_schema: "public",
  table_name: "signed_agreements",
  trigger_name: "signed_agreements_complete_immutable",
  is_internal: false,
  trigger_type: 27,
  enabled_state: "O",
  function_oid: expectedFunctionOid,
  function_schema: "public",
  function_name: "reject_completed_signed_agreement_mutation",
};

describe("migration audit catalog predicates", () => {
  it("accepts only the enabled BEFORE row UPDATE+DELETE immutability trigger", () => {
    expect(
      isExactSignedAgreementImmutabilityTrigger(
        [exactTriggerRow],
        expectedFunctionOid,
      ),
    ).toBe(true);

    const failures = [
      [],
      [{ ...exactTriggerRow, enabled_state: "D" }],
      [{ ...exactTriggerRow, trigger_type: 19 }],
      [{ ...exactTriggerRow, function_oid: "5252" }],
      [{ ...exactTriggerRow, table_name: "presentations" }],
    ];
    for (const rows of failures) {
      expect(
        isExactSignedAgreementImmutabilityTrigger(rows, expectedFunctionOid),
      ).toBe(false);
    }
  });

  it("requires one owner ACL and one service_role EXECUTE grant per function", () => {
    const rows = exactAclRows();
    expect(hasExactAuthorityFunctionAcl(rows, expectedFunctionNames)).toBe(true);
    expect(
      hasExactAuthorityFunctionAcl(
        [
          ...rows,
          {
            ...rows[1],
            grantee_oid: "30",
            grantee_name: "unexpected_operator",
          },
        ],
        expectedFunctionNames,
      ),
    ).toBe(false);
    expect(
      hasExactAuthorityFunctionAcl(rows.slice(0, -1), expectedFunctionNames),
    ).toBe(false);
  });

  it("queries exact trigger attributes and expands every function ACL recipient", () => {
    const audit = readFileSync(
      new URL("../../scripts/audit-migrations.mjs", import.meta.url),
      "utf8",
    );
    const triggerQuery = audit
      .split("\n")
      .find(
        (line) =>
          line.includes("client.query") &&
          line.includes("signed_agreements_complete_immutable'"),
      );
    const aclQuery = audit
      .split("\n")
      .find((line) => line.includes("pg_catalog.aclexplode"));

    expect(triggerQuery).toContain("t.tgisinternal");
    expect(triggerQuery).toContain("t.tgtype");
    expect(triggerQuery).toContain("t.tgenabled");
    expect(triggerQuery).toContain("t.tgfoid");
    expect(triggerQuery).toContain("function_namespace.nspname");
    expect(triggerQuery).not.toContain("pg_get_triggerdef");
    expect(aclQuery).toContain("p.proowner");
    expect(aclQuery).toContain("acl.grantee");
    expect(aclQuery).not.toContain("grantee in");
  });

  it("accepts only the 042 service RPC grant and both exact immutable triggers", () => {
    const tableAclRows = [
      ["obligation_events", "INSERT"],
      ["obligation_events", "SELECT"],
      ["obligations", "INSERT"],
      ["obligations", "SELECT"],
      ["obligations", "UPDATE"],
      ["website_membership_sales", "SELECT"],
    ].map(([table_name, privilege_type]) => ({
      table_name,
      grantee: "service_role",
      privilege_type,
      is_grantable: false,
    }));
    expect(hasExactAtomicCompletionTableAcl(tableAclRows)).toBe(true);
    expect(
      hasExactAtomicCompletionTableAcl([
        ...tableAclRows,
        {
          table_name: "obligations",
          grantee: "service_role",
          privilege_type: "DELETE",
          is_grantable: false,
        },
      ]),
    ).toBe(false);
    expect(
      hasExactAtomicCompletionTableAcl([
        ...tableAclRows.slice(0, -1),
        {
          table_name: "website_membership_sales",
          grantee: "service_role",
          privilege_type: "SELECT",
          is_grantable: true,
        },
      ]),
    ).toBe(false);

    const aclRows = [{
      grantee: "service_role",
      routine_name: "activate_membership_after_stripe_setup",
      privilege_type: "EXECUTE",
    }];
    expect(hasExactAtomicCompletionNonOwnerAcl(aclRows)).toBe(true);
    expect(
      hasExactAtomicCompletionNonOwnerAcl([
        ...aclRows,
        {
          grantee: "service_role",
          routine_name: "reject_website_membership_sale_change",
          privilege_type: "EXECUTE",
        },
      ]),
    ).toBe(false);

    const triggerRows = [
      {
        table_name: "obligation_events",
        trigger_name: "obligation_events_membership_activated_immutable",
        trigger_type: 27,
        enabled_state: "O",
        function_oid: "4201",
      },
      {
        table_name: "website_membership_sales",
        trigger_name: "website_membership_sales_immutable",
        trigger_type: 27,
        enabled_state: "O",
        function_oid: "4202",
      },
    ];
    expect(
      isExactAtomicCompletionTriggerSet(triggerRows, "4201", "4202"),
    ).toBe(true);
    expect(
      isExactAtomicCompletionTriggerSet(
        [{ ...triggerRows[0], enabled_state: "D" }, triggerRows[1]],
        "4201",
        "4202",
      ),
    ).toBe(false);
  });

  it("audits migration 042 from its replacement source and catalog evidence", () => {
    const audit = readFileSync(
      new URL("../../scripts/audit-migrations.mjs", import.meta.url),
      "utf8",
    );
    for (const fragment of [
      "042_atomic_membership_activation_completion.sql",
      '["042", "atomic membership activation completion"',
      "obligation_events_membership_activated_uidx",
      "website_membership_sales_immutable",
      "obligation_events_membership_activated_immutable",
      "expectedMigration042FunctionBody(\"activate_membership_after_stripe_setup\")",
      "atomicCompletionTableAclExact",
      "atomicCompletionBrowserPolicies",
      "c.relname in ('obligations', 'obligation_events', 'website_membership_sales')",
      "acl.grantee <> c.relowner",
      "pg_catalog.pg_has_role('authenticated', policy_role.role_oid, 'MEMBER')",
    ]) {
      expect(audit).toContain(fragment);
    }
  });

  it("records migration 043 completion/evidence schema and function evidence", () => {
    const audit = readFileSync(
      new URL("../../scripts/audit-migrations.mjs", import.meta.url),
      "utf8",
    );
    for (const fragment of [
      "043_authoritative_visit_completion_evidence.sql",
      '["043", "authoritative visit completion and evidence"',
      '"jobber_visit_completion_events", "visit_text_evidence"',
      "visitCompletionTableAclExact",
      "visitCompletionFunctionAclExact",
      "visitCompletionFunctionDefinitionsExact",
      "visitCompletionTriggersExact",
      "visitCompletionConstraintsExact",
      "visitCompletionBrowserPolicies === 0",
      'expectedMigration043FunctionBody("confirm_jobber_visit_completion")',
      "pg_catalog.aclexplode",
      "con.convalidated",
      "con.condeferrable",
      "con.condeferred",
      "pg_catalog.pg_get_constraintdef(con.oid)",
    ]) {
      expect(audit).toContain(fragment);
    }
  });

  it("fails migration 043 audit predicates for widened ACLs or disabled immutability", () => {
    const tableRows = [
      ["jobber_visit_completion_events", "SELECT"],
      ["visit_text_evidence", "SELECT"],
    ].map(([table_name, privilege_type]) => ({
      table_name,
      grantee: "service_role",
      privilege_type,
      is_grantable: false,
    }));
    expect(hasExactVisitCompletionTableAcl(tableRows)).toBe(true);
    expect(hasExactVisitCompletionTableAcl([
      ...tableRows,
      { ...tableRows[0], grantee: "authenticated" },
    ])).toBe(false);

    const names = [
      "append_visit_text_evidence",
      "confirm_jobber_visit_completion",
      "reject_authoritative_visit_evidence_change",
    ];
    const functionRows = names.flatMap((name, index) => {
      const owner = {
        function_oid: String(4300 + index),
        routine_name: name,
        owner_oid: "10",
        grantee_oid: "10",
        grantee_name: "postgres",
        is_owner: true,
        privilege_type: "EXECUTE",
        is_grantable: false,
      };
      return name.startsWith("reject_")
        ? [owner]
        : [owner, {
            ...owner,
            grantee_oid: "20",
            grantee_name: "service_role",
            is_owner: false,
          }];
    });
    expect(hasExactVisitCompletionFunctionAcl(functionRows)).toBe(true);
    expect(hasExactVisitCompletionFunctionAcl([
      ...functionRows,
      {
        ...functionRows[0],
        grantee_oid: "30",
        grantee_name: "authenticated",
        is_owner: false,
      },
    ])).toBe(false);

    const triggers = [
      {
        table_name: "jobber_visit_completion_events",
        trigger_name: "jobber_visit_completion_events_immutable",
        trigger_type: 27,
        enabled_state: "O",
        function_oid: "4343",
      },
      {
        table_name: "visit_text_evidence",
        trigger_name: "visit_text_evidence_immutable",
        trigger_type: 27,
        enabled_state: "O",
        function_oid: "4343",
      },
    ];
    expect(isExactVisitCompletionTriggerSet(triggers, "4343")).toBe(true);
    expect(isExactVisitCompletionTriggerSet([
      { ...triggers[0], enabled_state: "D" },
      triggers[1],
    ], "4343")).toBe(false);
  });

  it("requires migration 043 authority clauses and exact key relationships", () => {
    const migration = readFileSync(
      new URL(
        "./supabase/migrations/043_authoritative_visit_completion_evidence.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(assertMigration043RequiredClauses(migration)).toBe(true);
    expect(() => assertMigration043RequiredClauses(
      migration.replace("connection_row.status <> 'connected'", "true"),
    )).toThrow("required authority clause");
    expect(() => assertMigration043RequiredClauses(
      migration.replace(
        "where connection.id = appointment_identity.connection_id\n  for share;",
        "where connection.id = appointment_identity.connection_id;",
      ),
    )).toThrow("required connection lock");

    const rows = expectedVisitCompletionConstraintInventory();
    const checkIndex = rows.findIndex(
      (row) => row.definition ===
        "check((provider_visit_status='COMPLETED'::text))",
    );
    expect(checkIndex).toBeGreaterThan(-1);
    expect(hasExactVisitCompletionConstraints(rows)).toBe(true);
    expect(hasExactVisitCompletionConstraints(rows.slice(0, -1))).toBe(false);
    for (const mutation of [
      { definition: "check((provider_is_complete=false))" },
      { validated: false },
      { deferrable: true },
      { deferred: true },
    ]) {
      expect(hasExactVisitCompletionConstraints([
        ...rows.slice(0, checkIndex),
        { ...rows[checkIndex], ...mutation },
        ...rows.slice(checkIndex + 1),
      ])).toBe(false);
    }
    expect(rows.filter((row) => row.constraint_type === "c")).toHaveLength(10);
    const foreignKeyIndex = rows.findIndex(
      (row) => row.constraint_type === "f",
    );
    expect(foreignKeyIndex).toBeGreaterThan(-1);
    for (const mutation of [
      { validated: false },
      { deferrable: true },
      { deferred: true },
    ]) {
      expect(hasExactVisitCompletionConstraints([
        ...rows.slice(0, foreignKeyIndex),
        { ...rows[foreignKeyIndex], ...mutation },
        ...rows.slice(foreignKeyIndex + 1),
      ])).toBe(false);
    }
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table_name: "member_appointments",
        constraint_name: "member_appointments_jobber_authority_state_check",
      }),
      expect.objectContaining({
        table_name: "member_appointments",
        constraint_name: "member_appointments_jobber_authority_binding_check",
      }),
    ]));
    for (const constraintName of [
      "member_appointments_jobber_authority_state_check",
      "member_appointments_jobber_authority_binding_check",
    ]) {
      const appointmentCheckIndex = rows.findIndex(
        (row) => row.constraint_name === constraintName,
      );
      expect(appointmentCheckIndex).toBeGreaterThan(-1);
      expect(hasExactVisitCompletionConstraints([
        ...rows.slice(0, appointmentCheckIndex),
        {
          ...rows[appointmentCheckIndex],
          definition: "check((true))",
        },
        ...rows.slice(appointmentCheckIndex + 1),
      ])).toBe(false);
    }
  });

  it("requires the exact migration 044 UUID column, partial index, and trigger", () => {
    const column = {
      table_schema: "public",
      table_name: "jobber_connection_events",
      column_name: "oauth_operation_id",
      data_type: "uuid",
      udt_name: "uuid",
      is_nullable: "YES",
      column_default: null,
    };
    expect(isExactJobberOauthOperationColumn([column])).toBe(true);
    expect(
      isExactJobberOauthOperationColumn([
        { ...column, is_nullable: "NO" },
      ]),
    ).toBe(false);

    const index = {
      index_schema: "public",
      index_name: "jobber_connection_events_oauth_operation_uidx",
      table_schema: "public",
      table_name: "jobber_connection_events",
      access_method: "btree",
      is_unique: true,
      is_valid: true,
      is_ready: true,
      key_attribute_count: 1,
      attribute_count: 1,
      columns: ["oauth_operation_id"],
      predicate: "(oauth_operation_id IS NOT NULL)",
    };
    expect(isExactJobberOauthOperationIndex([index])).toBe(true);
    expect(
      isExactJobberOauthOperationIndex([
        { ...index, predicate: null },
      ]),
    ).toBe(false);
    expect(
      isExactJobberOauthOperationIndex([
        { ...index, is_unique: false },
      ]),
    ).toBe(false);

    const trigger = {
      table_schema: "public",
      table_name: "jobber_connection_events",
      trigger_name: "jobber_connection_events_immutable",
      is_internal: false,
      trigger_type: 27,
      enabled_state: "O",
      function_schema: "public",
      function_name: "reject_jobber_connection_event_change",
      language_name: "plpgsql",
      security_definer: false,
      is_strict: false,
      volatility: "v",
      parallel_mode: "u",
      config: "search_path=public",
      body: `
begin
  raise exception 'jobber_connection_events is append-only and immutable';
end;`,
    };
    expect(isExactJobberConnectionEventImmutabilityTrigger([trigger])).toBe(true);
    expect(
      isExactJobberConnectionEventImmutabilityTrigger([
        { ...trigger, enabled_state: "D" },
      ]),
    ).toBe(false);
    expect(
      isExactJobberConnectionEventImmutabilityTrigger([
        { ...trigger, body: "begin return old; end;" },
      ]),
    ).toBe(false);
  });

  it("requires the sole exact database-owned Jobber OAuth function definition", () => {
    const migration = readFileSync(
      new URL(
        "./supabase/migrations/044_jobber_oauth_authority_hardening.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const body = migration.match(
      /create or replace function public\.save_jobber_connection_with_event\([\s\S]*?\nas \$\$([\s\S]*?)\n\$\$;/i,
    )?.[1];
    expect(body).toBeDefined();
    const definition = {
      function_schema: "public",
      proname: "save_jobber_connection_with_event",
      argument_types:
        "uuid, text, text, text, text, text, timestamp with time zone, text, uuid",
      argument_names: [
        "requested_operation_id",
        "requested_expected_account_id",
        "requested_account_id",
        "requested_account_name",
        "requested_access_token_ciphertext",
        "requested_refresh_token_ciphertext",
        "requested_access_token_expires_at",
        "requested_graphql_version",
        "requested_actor_id",
      ],
      argument_defaults: null,
      result_type: "text",
      language_name: "plpgsql",
      security_definer: true,
      is_strict: false,
      volatility: "v",
      parallel_mode: "u",
      config: "search_path=pg_catalog",
      body,
    };
    expect(isExactJobberOauthFunctionDefinition([definition])).toBe(true);
    expect(
      isExactJobberOauthFunctionDefinition([
        { ...definition, security_definer: false },
      ]),
    ).toBe(false);
    expect(
      isExactJobberOauthFunctionDefinition([
        definition,
        { ...definition, argument_types: "text" },
      ]),
    ).toBe(false);
  });

  it("audits migration 044 from exact catalog evidence", () => {
    const audit = readFileSync(
      new URL("../../scripts/audit-migrations.mjs", import.meta.url),
      "utf8",
    );
    for (const fragment of [
      "044_jobber_oauth_authority_hardening.sql",
      "032_jobber_oauth_connection.sql",
      '["044", "Jobber OAuth authority hardening"',
      "jobber_connection_events_oauth_operation_uidx",
      "expectedMigration044FunctionBody(\"save_jobber_connection_with_event\")",
      "isExactJobberOauthFunctionDefinition",
      "hasExactAuthorityFunctionAcl",
      "jobberConnectionEventTriggerExact",
      "expectedMigration032FunctionBody",
      "jobberOauthBrowserGrants",
      "jobberOauthBrowserPolicies",
      "pg_catalog.aclexplode",
      "pg_catalog.pg_has_role('authenticated', policy_role.role_oid, 'MEMBER')",
    ]) {
      expect(audit).toContain(fragment);
    }
  });
});
