import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./084_sales_service_interest_continuity.sql", import.meta.url),
  "utf8",
).toLowerCase();
const audit = readFileSync(
  new URL("../../../../scripts/audit-migrations.mjs", import.meta.url),
  "utf8",
);

describe("sales service interest continuity migration", () => {
  it("extends the bounded private vocabulary without changing existing data", () => {
    expect(migration.trimStart()).toContain("-- migration 084");
    expect(migration).toContain("cardinality(service_interests) between 1 and 9");
    expect(migration).toContain(
      "service_interests @> array['exterior_windows']::text[]",
    );
    for (const interest of [
      "solar_panels",
      "pressure_washing",
      "gutter_cleaning",
      "home_care_membership",
    ]) {
      expect(migration).toContain(`'${interest}'`);
      expect(audit).toContain(`"${interest}"`);
    }
    expect(migration).not.toMatch(/\b(?:insert|update|delete)\b/);
  });

  it("does not widen browser access or trigger messages, contracts, or charges", () => {
    expect(migration).not.toMatch(/\bgrant\b|create\s+policy/i);
    expect(migration).not.toMatch(/create\s+trigger/i);
    expect(migration).not.toMatch(/stripe|twilio|resend|docusign/i);
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });
});
