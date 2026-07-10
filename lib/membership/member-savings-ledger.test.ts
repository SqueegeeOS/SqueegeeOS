import { describe, expect, it } from "vitest";
import { buildMemberSavingsLedgerView } from "./member-savings-ledger";
import { mapMemberCareAddonRecord } from "./portal-care-addons";

describe("buildMemberSavingsLedgerView", () => {
  it("totals Sylvia moss add-on savings plus completed visit savings", () => {
    const mossAddon = mapMemberCareAddonRecord({
      id: "addon-moss-1",
      service_name: "Moss Removal + Treatment",
      service_date: "2026-07-11",
      amount_charged_cents: 30000,
      saved_cents: 7500,
      status: "paid",
    });

    const ledger = buildMemberSavingsLedgerView({
      tierId: "biannual",
      addonDiscountPercent: 20,
      enrollmentSavingsPerVisit: 100,
      appointments: [
        {
          id: "visit-1",
          date: "2026-06-15T12:00:00.000Z",
          status: "completed",
          serviceType: "biannual_home_care",
        },
      ],
      careAddons: [mossAddon],
    });

    expect(ledger.addonServices.total).toBe(75);
    expect(ledger.addonServices.lines).toHaveLength(1);
    expect(ledger.addonServices.lines[0]?.label).toBe("Moss Removal + Treatment");
    expect(ledger.addonServices.lines[0]?.amount).toBe(75);

    expect(ledger.membershipVisits.total).toBe(100);
    expect(ledger.membershipVisits.lines).toHaveLength(1);

    expect(ledger.totalServiceSavings).toBe(175);
    expect(ledger.totalServiceSavingsLabel).toContain("175");
    expect(ledger.hasAnySavings).toBe(true);
  });

  it("uses persisted ledger lines when provided", () => {
    const ledger = buildMemberSavingsLedgerView({
      tierId: "quarterly",
      addonDiscountPercent: 25,
      enrollmentSavingsPerVisit: 150,
      appointments: [],
      careAddons: [],
      persistedLines: [
        {
          id: "addon-1",
          entryType: "addon_service",
          label: "Screen cleaning",
          amount: 30,
          occurredAt: "2026-07-01T12:00:00.000Z",
          detail: null,
        },
      ],
    });

    expect(ledger.addonServices.total).toBe(30);
    expect(ledger.membershipVisits.total).toBe(0);
    expect(ledger.totalServiceSavings).toBe(30);
  });

  it("returns zero savings when no completed visits or paid add-ons", () => {
    const ledger = buildMemberSavingsLedgerView({
      tierId: "biannual",
      addonDiscountPercent: 20,
      enrollmentSavingsPerVisit: 100,
      appointments: [
        {
          id: "visit-scheduled",
          date: "2026-08-15T12:00:00.000Z",
          status: "scheduled",
          serviceType: "biannual_home_care",
        },
      ],
      careAddons: [],
    });

    expect(ledger.totalServiceSavings).toBe(0);
    expect(ledger.hasAnySavings).toBe(false);
  });
});
