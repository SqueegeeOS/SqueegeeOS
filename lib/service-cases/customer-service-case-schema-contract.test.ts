import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/060_customer_service_cases.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();
const productionHealth = readFileSync(
  new URL("../admin/production-health-server.ts", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("./customer-service-case-actions-server.ts", import.meta.url),
  "utf8",
);

describe("customer service case schema contract", () => {
  it("stores a private idempotent member case ledger", () => {
    expect(migration).toContain(
      "create table if not exists public.customer_service_cases",
    );
    expect(migration).toContain(
      "constraint customer_service_cases_idempotency_unique unique",
    );
    expect(migration).toContain("membership_id,");
    expect(migration).toContain("client_request_id");
    expect(migration).toContain(
      "alter table public.customer_service_cases enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.customer_service_cases",
    );
    expect(migration).toContain(
      "on table public.customer_service_cases to service_role",
    );
    expect(migration).toContain("('customer_service_cases')");
  });

  it("keeps the schema observable and provider side effects out of case writes", () => {
    expect(productionHealth).toContain('id: "customer-service-cases-schema"');
    expect(productionHealth).toContain('table: "customer_service_cases"');
    expect(actions).not.toMatch(/twilio|resend|sendoutboundcommunication/i);
    expect(actions).toContain("input.access.membershipId");
    expect(actions).toContain("input.access.homeownerId");
    expect(actions).toContain("input.access.propertyId");
    const portalSelect = actions.match(
      /const PORTAL_SELECT =\s*\n?\s*"([^"]+)"/,
    )?.[1];
    expect(portalSelect).toBeTruthy();
    expect(portalSelect).not.toContain("owner_note");
  });
});
