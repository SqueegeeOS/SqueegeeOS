import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "lib/persistence/supabase/migrations/080_sales_lead_service_interests.sql",
  ),
  "utf8",
).toLowerCase();

describe("sales lead service interests migration", () => {
  it("adds one bounded non-null interest array with exterior as the safe default", () => {
    expect(migration).toContain("add column if not exists service_interests text[] not null");
    expect(migration).toContain("default array['exterior_windows']::text[]");
    expect(migration).toContain("cardinality(service_interests) between 1 and 5");
    expect(migration).toContain("service_interests @> array['exterior_windows']::text[]");
    for (const interest of [
      "exterior_windows",
      "interior_windows",
      "screens",
      "cobweb_removal",
      "other",
    ]) {
      expect(migration).toContain(`'${interest}'`);
    }
  });

  it("does not widen browser privileges or create a sending or billing trigger", () => {
    expect(migration).not.toMatch(/grant\s+.+\s+to\s+(anon|authenticated)/);
    expect(migration).not.toContain("create trigger");
    expect(migration).not.toContain("stripe");
    expect(migration).not.toContain("twilio");
    expect(migration).not.toContain("resend");
  });
});
