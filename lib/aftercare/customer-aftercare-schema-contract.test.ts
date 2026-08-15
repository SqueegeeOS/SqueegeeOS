import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/059_customer_aftercare_resolutions.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();
const productionHealth = readFileSync(
  new URL("../admin/production-health-server.ts", import.meta.url),
  "utf8",
);

describe("customer aftercare schema contract", () => {
  it("stores only explicit, idempotent owner dispositions", () => {
    expect(migration).toContain(
      "create table if not exists public.customer_aftercare_resolutions",
    );
    expect(migration).toContain("task_key text not null unique");
    expect(migration).toContain("'review_opportunity'");
    expect(migration).toContain("'annual_care_checkin'");
    expect(migration).toContain("customer_aftercare_outcome_check");
    expect(migration).toContain("customer_aftercare_resolution_outcome_check");
  });

  it("keeps the ledger server-only and inside the production privacy probe", () => {
    expect(migration).toContain(
      "alter table public.customer_aftercare_resolutions enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.customer_aftercare_resolutions",
    );
    expect(migration).toContain(
      "on table public.customer_aftercare_resolutions to service_role",
    );
    expect(migration).toContain("('customer_aftercare_resolutions')");
    expect(productionHealth).toContain('id: "customer-aftercare-schema"');
    expect(productionHealth).toContain('table: "customer_aftercare_resolutions"');
  });

  it("does not add a messaging or payment side effect", () => {
    expect(migration).not.toMatch(/insert\s+into\s+public\.customer_messages/);
    expect(migration).not.toMatch(/stripe|payment_intent|twilio|resend/);
  });
});
