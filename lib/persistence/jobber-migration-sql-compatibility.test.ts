import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrations = [
  "038_jobber_schedule_coverage_sync.sql",
  "039_jobber_visit_classification.sql",
  "040_jobber_member_property_search_link.sql",
  "041_jobber_property_link_revocation.sql",
].map((name) =>
  readFileSync(
    new URL(`./supabase/migrations/${name}`, import.meta.url),
    "utf8",
  ),
);

describe("Jobber migration SQL compatibility", () => {
  it("does not schema-qualify PostgreSQL special expressions as functions", () => {
    for (const migration of migrations) {
      expect(migration).not.toMatch(/pg_catalog\.(?:coalesce|greatest)\s*\(/i);
    }
  });
});
