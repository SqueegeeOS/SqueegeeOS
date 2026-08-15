import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "lib/persistence/supabase/migrations/064_member_addon_checkout.sql",
  "utf8",
);

describe("member add-on checkout schema", () => {
  it("stores customer-approved Stripe evidence without exposing payment URLs", () => {
    expect(migration).toContain("stripe_checkout_session_id");
    expect(migration).toContain("stripe_payment_intent_id");
    expect(migration).toContain("customer_approved_at");
    expect(migration).toContain("member_addon_checkout_session_unique");
    expect(migration).toContain("member_addon_payment_intent_unique");
    expect(migration).toMatch(
      /revoke all privileges on table public\.member_addon_transactions\s+from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant select, insert, update, delete on table public\.member_addon_transactions\s+to service_role/,
    );
  });
});
