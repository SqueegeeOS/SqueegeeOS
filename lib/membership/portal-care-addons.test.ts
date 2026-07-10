import { describe, expect, it } from "vitest";
import {
  buildPortalCareAddons,
  mapMemberCareAddonRecord,
} from "./portal-care-addons";

describe("portal care addons", () => {
  it("shows Sylvia moss removal with member savings", () => {
    const entries = buildPortalCareAddons([
      mapMemberCareAddonRecord({
        id: "addon-1",
        service_name: "Moss Removal + Treatment",
        service_date: "2026-07-11",
        amount_charged_cents: 30000,
        saved_cents: 7500,
        status: "paid",
      }),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.serviceName).toBe("Moss Removal + Treatment");
    expect(entries[0]?.amountPaidLabel).toContain("300");
    expect(entries[0]?.savingsLabel).toContain("75");
  });

  it("hides quoted and scheduled add-ons from the customer portal", () => {
    const entries = buildPortalCareAddons([
      mapMemberCareAddonRecord({
        id: "addon-1",
        service_name: "Quoted only",
        service_date: "2026-07-11",
        amount_charged_cents: 10000,
        saved_cents: 0,
        status: "quoted",
      }),
    ]);

    expect(entries).toHaveLength(0);
  });
});
