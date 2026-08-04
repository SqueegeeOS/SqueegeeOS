import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const server = read("./attribution-lifecycle-server.ts");
const setupPayment = read("../../app/api/membership/setup-payment/route.ts");
const archiveMembership = read("../admin/archive-membership.ts");
const dailyCron = read("../../app/api/cron/jobber-reconcile/route.ts");

describe("sales attribution lifecycle integration", () => {
  it("updates only existing signature attribution and promotes its owned lead", () => {
    expect(server).toContain('.from("sales_rep_attributions")');
    expect(server).not.toContain('.from("sales_rep_attributions").insert');
    expect(server).toContain('status: "won"');
    expect(server).toContain("converted_homeowner_id: membership.homeowner_id");
    expect(server).toContain("converted_membership_id: membership.id");
    expect(server).toContain('.eq("rep_id", attribution.rep_id)');
  });

  it("makes attribution activation an explicit nonfatal payment repair step", () => {
    expect(setupPayment).toContain('| "sales_attribution"');
    expect(setupPayment).toContain("activateSalesAttribution(input.supabase");
    expect(setupPayment).toContain(
      'return "sales_attribution";',
    );
    expect(setupPayment).toContain("salesAttributionRepairRequired");
  });

  it("cancels attribution without making membership archive fail", () => {
    expect(archiveMembership).toContain(
      "await syncMembershipSalesAttributionLifecycle",
    );
    expect(archiveMembership).toContain(
      "salesAttributionRepairRequired = true",
    );
    expect(archiveMembership).toContain(
      'sales attribution cancellation failed',
    );
  });

  it("runs due retention qualification in the existing daily cron", () => {
    expect(dailyCron).toContain("await qualifyDueSalesAttributions");
    expect(dailyCron).toContain("retentionQualifications");
    expect(dailyCron).toContain(
      "Sales retention qualification failed; Jobber reconciliation continued.",
    );
  });
});
