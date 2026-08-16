import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const signatureCompletion = read("./complete-remote-signature.ts");
const stripeReconciliation = read("./reconcile-stripe-setup.ts");
const docusignProcessor = read("./process-docusign-connect.ts");
const attributionServer = read("../sales/signed-attribution-server.ts");
const reconciliationCron = read("../../app/api/cron/jobber-reconcile/route.ts");

describe("remote enrollment sales attribution contract", () => {
  it("records signature-backed attribution for both first completion and webhook retries", () => {
    expect(signatureCompletion).toContain(
      'import { recordSignedMembershipAttribution } from "@/lib/sales/signed-attribution-server"',
    );
    expect(
      signatureCompletion.match(/recordRemoteSalesAttribution\(/g),
    ).toHaveLength(3);
    expect(signatureCompletion).toContain('return "repair_required";');
    expect(signatureCompletion).toContain("existingAgreement.data.membership_id");
    expect(signatureCompletion).toContain("presentationId: presentation.id");
  });

  it("preserves customer progress while recording attribution repair evidence", () => {
    expect(signatureCompletion).toContain(
      'console.error("[remote-enrollment] sales attribution repair required"',
    );
    expect(docusignProcessor).toContain(
      "salesAttribution: completed.salesAttribution",
    );
  });

  it("retries missing attribution before activating its lifecycle at Stripe completion", () => {
    const repairIndex = stripeReconciliation.indexOf(
      "await recordSignedMembershipAttribution({",
    );
    const lifecycleIndex = stripeReconciliation.indexOf(
      "await syncMembershipSalesAttributionLifecycle({",
    );

    expect(repairIndex).toBeGreaterThan(-1);
    expect(lifecycleIndex).toBeGreaterThan(repairIndex);
    expect(stripeReconciliation).toContain('repair.push("sales_attribution")');
  });

  it("repairs any remaining signed closes in the bounded daily reconciliation", () => {
    expect(attributionServer).toContain(
      "reconcileSignedMembershipAttributionsForActiveReps",
    );
    expect(attributionServer).toContain("Math.min(25");
    expect(attributionServer).toContain(
      'select("id", { count: "exact" })',
    );
    expect(reconciliationCron).toContain(
      "await reconcileSignedMembershipAttributionsForActiveReps()",
    );
    expect(
      reconciliationCron.indexOf(
        "await reconcileSignedMembershipAttributionsForActiveReps()",
      ),
    ).toBeLessThan(
      reconciliationCron.indexOf("await qualifyDueSalesAttributions({"),
    );
  });
});
