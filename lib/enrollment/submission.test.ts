import { describe, expect, it } from "vitest";
import { parseEnrollmentSubmission } from "./submission";

const validBody = {
  presentationId: "00000000-0000-4000-8000-000000000086",
  tier: "quarterly",
  firstVisitPrice: 275,
  recurringVisitPrice: "200",
  annualizedValue: 875,
  salesContext: "customer_home",
  homeSolicitationNoticeDays: 3,
};

describe("enrollment submission parser", () => {
  it("keeps send and preflight inputs on one normalized contract", () => {
    const parsed = parseEnrollmentSubmission(validBody);

    expect(parsed).toEqual({
      ok: true,
      value: {
        presentationId: validBody.presentationId,
        tier: "quarterly",
        firstVisitPrice: 275,
        recurringVisitPrice: 200,
        annualizedValue: 875,
        salesContext: "customer_home",
        homeSolicitationNoticeDays: 3,
        paymentRail: "stripe_card",
        signatureProvider: "homeatlas_native",
      },
    });
  });

  it("preserves an explicit legacy DocuSign selection", () => {
    const parsed = parseEnrollmentSubmission({
      ...validBody,
      signatureProvider: "docusign",
    });

    expect(parsed.ok && parsed.value.signatureProvider).toBe("docusign");
  });

  it("preserves an explicit cash/check rail and strips inapplicable notice days", () => {
    const parsed = parseEnrollmentSubmission({
      ...validBody,
      salesContext: "remote",
      paymentRail: "manual_cash_check",
    });

    expect(parsed.ok && parsed.value.paymentRail).toBe("manual_cash_check");
    expect(parsed.ok && parsed.value.homeSolicitationNoticeDays).toBeNull();
  });

  it("fails closed on missing or out-of-range pricing", () => {
    expect(
      parseEnrollmentSubmission({ ...validBody, recurringVisitPrice: 0 }).ok,
    ).toBe(false);
    expect(
      parseEnrollmentSubmission({ ...validBody, annualizedValue: 1_000_001 }).ok,
    ).toBe(false);
  });
});
