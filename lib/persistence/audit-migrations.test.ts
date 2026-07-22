import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  hasExactAtomicCompletionNonOwnerAcl,
  hasExactAtomicCompletionTableAcl,
  hasExactAuthorityFunctionAcl,
  isExactAtomicCompletionTriggerSet,
  isExactSignedAgreementImmutabilityTrigger,
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
});
