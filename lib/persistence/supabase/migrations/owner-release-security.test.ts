import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./086_owner_released_enrollment_documents.sql", import.meta.url),
  "utf8",
);

describe("owner-released enrollment document migration", () => {
  it("keeps owner release atomic, hashed, and service-role only", () => {
    expect(migration).toContain("release_enrollment_agreement_pair");
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("'^[0-9a-f]{64}$'");
    expect(migration).toContain("release_authority = 'owner'");
    expect(migration).toContain("counsel_review_status = 'pending'");
    expect(migration).toContain("grant execute");
    expect(migration).not.toMatch(/net\.http|http_post|create.*envelope/i);
  });
});
