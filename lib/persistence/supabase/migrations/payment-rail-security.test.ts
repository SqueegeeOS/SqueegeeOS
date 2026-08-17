import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./083_payment_rail_and_visit_sequence.sql", import.meta.url),
  "utf8",
);

describe("migration 083 payment rail boundaries", () => {
  it("is transactional and preserves every existing account on Stripe", () => {
    expect(migration.trimStart().toLowerCase()).toContain("begin;");
    expect(migration.trim().toLowerCase().endsWith("commit;")).toBe(true);
    expect(migration.match(/payment_rail text not null default 'stripe_card'/g))
      .toHaveLength(3);
  });

  it("requires auditable approval and disables automatic billing for manual accounts", () => {
    expect(migration).toContain("payment_rail = 'manual_cash_check'");
    expect(migration).toContain("manual_payment_approved_at is not null");
    expect(migration).toContain("manual_payment_approved_by");
    expect(migration).toContain("automatic_billing_enabled = false");
  });

  it("changes no grants, policies, triggers, messages, or customer charge data", () => {
    expect(migration).not.toMatch(/\bgrant\b/i);
    expect(migration).not.toMatch(/create\s+policy/i);
    expect(migration).not.toMatch(/create\s+trigger/i);
    expect(migration).not.toMatch(/payment_intent|checkout_session|message_log/i);
  });
});
