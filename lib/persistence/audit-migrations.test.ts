import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  hasExactAuthorityFunctionAcl,
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
});
