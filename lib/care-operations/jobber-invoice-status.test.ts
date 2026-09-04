import { describe, expect, it } from "vitest";
import { jobberInvoiceDisplay } from "./jobber-invoice-status";

describe("source-qualified owner invoice labels", () => {
  it("labels paid as a Jobber observation, not a new collection or Stripe settlement", () => {
    expect(jobberInvoiceDisplay("paid")).toMatchObject({ label: "Paid in Jobber", tone: "success" });
    expect(jobberInvoiceDisplay("PAID").detail).toContain("last Jobber sync");
    expect(jobberInvoiceDisplay("paid").detail).toContain("No payment action");
  });
  it("does not equate a missing invoice with a zero balance", () => {
    expect(jobberInvoiceDisplay("NONE")).toMatchObject({ label: "No invoice attached", tone: "neutral" });
    expect(jobberInvoiceDisplay("NONE").detail).toContain("does not confirm that nothing is owed");
  });
  it("keeps hidden, missing and malformed states unknown instead of paid or unpaid", () => {
    for (const value of [undefined, null, "", "PERMISSION_HIDDEN", "<script>", "x".repeat(100)]) {
      expect(jobberInvoiceDisplay(value)).toMatchObject({ label: "Unavailable", tone: "warning" });
    }
    expect(jobberInvoiceDisplay("awaiting_payment").label).toBe("Awaiting payment");
    expect(jobberInvoiceDisplay("draft").tone).not.toBe("success");
  });
});
