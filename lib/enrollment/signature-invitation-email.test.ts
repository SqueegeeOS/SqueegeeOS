import { describe, expect, it } from "vitest";
import type { EnrollmentDocumentSnapshot } from "./types";
import { buildSignatureInvitationEmail } from "./signature-invitation-email";

const snapshot: EnrollmentDocumentSnapshot = {
  schemaVersion: 2,
  presentationId: "00000000-0000-4000-8000-000000000099",
  customer: {
    name: "Michael & Allegra Riley",
    email: "michael@example.com",
    phone: null,
  },
  signer: { name: "Michael Riley", email: "michael@example.com", phone: null },
  property: { fullAddress: "123 Example Lane", squareFeet: null, twoStory: false },
  plan: {
    tier: "quarterly",
    tierLabel: "Quarterly",
    cadence: "4 visits per year",
    visitsPerYear: 4,
    firstVisitPriceCents: 30_000,
    recurringVisitPriceCents: 30_000,
    annualizedValueCents: 160_000,
    addonDiscountPercent: 0,
    summary: "Alternating solar-only and solar-plus-window visits.",
    customerChoiceNote: "Options are added only when requested.",
    visits: [],
  },
  payment: {
    rail: "manual_cash_check",
    arrangementSummary: "Cash or check. No automatic card billing.",
  },
  disclosures: {
    salesContext: "remote",
    homeSolicitationNoticeDays: null,
    renewalSummary: "",
    cancellationSummary: "",
    rateChangeSummary: "",
    billingSummary: "",
    billingConsent: "",
  },
  createdAt: "2026-08-24T00:00:00.000Z",
};

describe("signature invitation email", () => {
  it("keeps the invitation simple, branded, and cash/check explicit", () => {
    const email = buildSignatureInvitationEmail({
      snapshot,
      enrollmentUrl: "https://www.squeegeeking.net/enroll/private-token",
    });

    expect(email.subject).toContain("Michael");
    expect(email.html).toContain("Review &amp; sign my agreement");
    expect(email.html).toContain("$1,600");
    expect(email.html).toContain("No card setup or automatic card billing");
    expect(email.html).toContain(
      "https://www.squeegeeking.net/enroll/private-token",
    );
    expect(email.text).toContain("Review and sign securely");
    expect(email.text).not.toContain("DocuSign email");
  });
});
