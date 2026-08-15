import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "lib/persistence/supabase/migrations/065_release_foreign_key_indexes.sql",
  "utf8",
);

describe("release foreign-key indexes", () => {
  it.each([
    "customer_aftercare_resolutions_homeowner_idx",
    "customer_aftercare_resolutions_property_idx",
    "customer_service_cases_homeowner_idx",
    "customer_service_cases_property_idx",
    "field_independence_reviews_property_idx",
    "technician_visit_events_property_idx",
  ])("creates %s idempotently", (indexName) => {
    expect(migration).toContain(`create index if not exists ${indexName}`);
  });

  it("only adds indexes and does not mutate customer or payment data", () => {
    expect(migration).not.toMatch(/insert\s+into|update\s+public|delete\s+from/i);
    expect(migration).not.toMatch(/stripe|twilio|resend|customer_messages/i);
  });
});
