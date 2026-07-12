import { describe, expect, it } from "vitest";
import { normalizeServiceMonth, projectMonthlyPreviewRow } from "./monthly-preview";

const order = {
  id: "order-1",
  membership_id: "membership-1",
  property_id: "property-1",
  obligation_id: "obligation-1",
  appointment_id: "appointment-1",
  pricing_snapshot_id: "snapshot-1",
  service_month: "2026-08-01",
  scheduled_service_at: "2026-08-12T16:00:00.000Z",
  amount_cents: 25000,
  credit_applied_cents: 5000,
  stripe_customer_ready: true,
  stripe_payment_method_ready: true,
};

const appointment = {
  id: "appointment-1",
  property_id: "property-1",
  matched_obligation_id: "obligation-1",
  scheduled_at: "2026-08-12T16:00:00.000Z",
  provider: "jobber",
  external_id: "visit-1",
  provenance_state: "provider_imported" as const,
  verification_state: "verified" as const,
  match_state: "matched" as const,
};

const snapshot = {
  id: "snapshot-1",
  engine_version: "atlas-window-care-v1.0",
  company_settings_version: "settings-1",
  authorized_charge_cents: 25000,
  override_amount_cents: null,
  membership_id: "membership-1",
  obligation_id: "obligation-1",
  property_id: "property-1",
};

const membership = {
  id: "membership-1",
  property_id: "property-1",
  homeowner_id: "homeowner-1",
  stripe_customer_id: "cus_1",
  stripe_payment_method_id: "pm_1",
};

const obligation = {
  id: "obligation-1",
  membership_id: "membership-1",
  property_id: "property-1",
};

describe("monthly billing preview read model", () => {
  it("normalizes valid month input and rejects invalid dates", () => {
    expect(normalizeServiceMonth("2026-08")).toBe("2026-08-01");
    expect(normalizeServiceMonth("2026-08-01")).toBe("2026-08-01");
    expect(normalizeServiceMonth("2026-13")).toBeNull();
    expect(normalizeServiceMonth("08-2026")).toBeNull();
  });

  it("derives a ready preview without enabling execution", () => {
    const row = projectMonthlyPreviewRow({
      order,
      appointment,
      snapshot,
      membership,
      obligation,
      property: { id: "property-1", address: "123 Main St" },
      homeowner: { id: "homeowner-1", full_name: "Home Owner" },
    });
    expect(row.billable).toBe(true);
    expect(row.expectedChargeCents).toBe(20000);
    expect(row.executionEnabled).toBe(false);
  });

  it("recomputes Stripe readiness from membership truth", () => {
    const row = projectMonthlyPreviewRow({
      order: { ...order, stripe_customer_ready: true, stripe_payment_method_ready: true },
      appointment,
      snapshot,
      membership: { ...membership, stripe_payment_method_id: null },
      obligation,
      property: undefined,
      homeowner: undefined,
    });
    expect(row.billable).toBe(false);
    expect(row.blockingReasons).toContain("stripe_payment_method_not_ready");
  });

  it("blocks a stored order when its immutable snapshot amount disagrees", () => {
    const row = projectMonthlyPreviewRow({
      order,
      appointment,
      snapshot: { ...snapshot, authorized_charge_cents: 26000 },
      membership,
      obligation,
      property: undefined,
      homeowner: undefined,
    });
    expect(row.billable).toBe(false);
    expect(row.blockingReasons).toContain("order_snapshot_amount_mismatch");
  });

  it("blocks missing linked evidence rather than trusting an order", () => {
    const row = projectMonthlyPreviewRow({
      order,
      appointment: undefined,
      snapshot: undefined,
      membership: undefined,
      obligation: undefined,
      property: undefined,
      homeowner: undefined,
    });
    expect(row.billable).toBe(false);
    expect(row.blockingReasons).toEqual(expect.arrayContaining([
      "appointment_record_missing",
      "pricing_snapshot_record_missing",
      "membership_record_missing",
      "obligation_record_missing",
    ]));
  });

  it("blocks IDs that exist but belong to a different billing chain", () => {
    const row = projectMonthlyPreviewRow({
      order,
      appointment: {
        ...appointment,
        property_id: "property-2",
        matched_obligation_id: "obligation-2",
      },
      snapshot: {
        ...snapshot,
        membership_id: "membership-2",
        obligation_id: "obligation-2",
        property_id: "property-2",
      },
      membership: { ...membership, property_id: "property-2" },
      obligation: {
        ...obligation,
        membership_id: "membership-2",
        property_id: "property-2",
      },
      property: undefined,
      homeowner: undefined,
    });

    expect(row.billable).toBe(false);
    expect(row.blockingReasons).toEqual(expect.arrayContaining([
      "membership_property_mismatch",
      "obligation_membership_mismatch",
      "obligation_property_mismatch",
      "appointment_property_mismatch",
      "appointment_obligation_mismatch",
      "snapshot_membership_mismatch",
      "snapshot_obligation_mismatch",
      "snapshot_property_mismatch",
    ]));
  });

  it("blocks a stale order time even when the service month is unchanged", () => {
    const row = projectMonthlyPreviewRow({
      order,
      appointment: { ...appointment, scheduled_at: "2026-08-13T16:00:00.000Z" },
      snapshot,
      membership,
      obligation,
      property: undefined,
      homeowner: undefined,
    });
    expect(row.blockingReasons).toContain("order_visit_time_mismatch");
  });

  it("uses an approved override recorded inside the immutable snapshot", () => {
    const row = projectMonthlyPreviewRow({
      order: { ...order, amount_cents: 24000 },
      appointment,
      snapshot: { ...snapshot, override_amount_cents: 24000 },
      membership,
      obligation,
      property: undefined,
      homeowner: undefined,
    });
    expect(row.billable).toBe(true);
    expect(row.expectedChargeCents).toBe(19000);
  });
});
