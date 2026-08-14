import { describe, expect, it } from "vitest";
import { resolveSalesLeadSmsHandoff } from "./lead-contact-handoff";

const lead = {
  id: "00000000-0000-4000-8000-000000000001",
  phone_normalized: "+15305550123",
  sms_consent_status: "opted_in" as const,
  sms_consent_recorded_at: "2026-08-14T15:00:00.000Z",
  sms_consent_disclosure_version: "d2d-service-follow-up-v1",
  sms_consent_source_path: "/david",
};

describe("sales lead contact handoff", () => {
  it("preserves exact-number field consent for the converted customer", () => {
    expect(
      resolveSalesLeadSmsHandoff({
        presentationPhone: "(530) 555-0123",
        lead,
      }),
    ).toEqual({
      phone: "+15305550123",
      verificationStatus: "verified",
      verifiedAt: "2026-08-14T15:00:00.000Z",
      consentStatus: "opted_in",
      consentSource:
        "sales_rep_lead:00000000-0000-4000-8000-000000000001:d2d-service-follow-up-v1",
      consentRecordedAt: "2026-08-14T15:00:00.000Z",
    });
  });

  it("fails closed when the presentation number no longer matches", () => {
    expect(
      resolveSalesLeadSmsHandoff({
        presentationPhone: "+15305550999",
        lead,
      }),
    ).toBeNull();
  });

  it("does not invent consent when evidence is incomplete", () => {
    expect(
      resolveSalesLeadSmsHandoff({
        presentationPhone: "+15305550123",
        lead: { ...lead, sms_consent_recorded_at: null },
      }),
    ).toMatchObject({
      verificationStatus: "unverified",
      consentStatus: "unknown",
      consentSource: null,
      consentRecordedAt: null,
    });
  });
});
