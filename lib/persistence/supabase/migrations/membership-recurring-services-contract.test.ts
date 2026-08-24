import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./055_membership_recurring_services.sql", import.meta.url),
  "utf8",
);

describe("membership recurring services schema", () => {
  it("keeps supplemental services itemized and computes their annual value", () => {
    expect(migration).toContain("create table if not exists public.membership_recurring_services");
    expect(migration).toContain("visits_per_year::integer * price_per_visit_cents");
    expect(migration).toContain("unique (membership_id, service_key)");
  });

  it("requires auditable evidence before a service is marked authorized", () => {
    expect(migration).toContain("owner_attested_verbal_consent");
    expect(migration).toContain("authorization_attested_at is not null");
    expect(migration).toContain("authorization_attested_by");
  });

  it("is service-role only", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all privileges");
    expect(migration).toContain("to service_role");
  });
});
