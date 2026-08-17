import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = read("./085_legal_review_copy_integrity.sql");
const packet = read("../../../enrollment/legal-review-packet.test.ts");
const readinessRoute = read(
  "../../../../app/api/admin/enrollment/readiness/route.ts",
);
const audit = read("../../../../scripts/audit-migrations.mjs");

describe("migration 085 legal review copy integrity", () => {
  it("pins the same two review-copy fingerprints enforced by application tests", () => {
    for (const fingerprint of [
      "2319bee07339c2a2b834847550329ed5f79980c594785b6c0f75c01152430d1d",
      "bb473f0977b215b24bbb4fc2970fc2afc0ccf54b9f80a59cc568767751d5dba9",
    ]) {
      expect(migration).toContain(fingerprint);
      expect(packet).toContain(fingerprint);
    }
  });

  it("records review evidence without approving or releasing a document", () => {
    expect(migration.trimStart().toLowerCase()).toContain("begin;");
    expect(migration.trim().toLowerCase().endsWith("commit;")).toBe(true);
    expect(migration).toContain("where status = 'attorney_review'");
    expect(migration).not.toMatch(/set\s+status\s*=\s*'approved'/i);
    expect(migration).not.toMatch(/set\s+content_sha256\s*=/i);
  });

  it("makes the staged hash inspectable and auditable", () => {
    expect(readinessRoute).toContain("review_copy_sha256");
    expect(audit).toContain('["085", "legal review copy integrity"');
    expect(audit).toContain(
      'hasColumn(s, "agreement_document_versions", "review_copy_sha256")',
    );
  });
});
