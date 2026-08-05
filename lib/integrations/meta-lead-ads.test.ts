import { describe, expect, it } from "vitest";
import {
  metaLeadToIntakeInput,
  parseMetaLeadWebhookPayload,
} from "./meta-lead-ads";

const reference = { leadgenId: "lead-123", pageId: "page-1", formId: "form-1" };
const details = {
  id: "lead-123",
  created_time: "2026-08-04T18:00:00+0000",
  campaign_id: "campaign-1",
  campaign_name: "Chico memberships",
  ad_id: "ad-1",
  ad_name: "Clean windows",
  form_id: "form-1",
  field_data: [
    { name: "full_name", values: ["Jamie Smith"] },
    { name: "phone_number", values: ["+15305550199"] },
    { name: "email", values: ["jamie@example.com"] },
    { name: "street_address", values: ["123 Main St"] },
    { name: "which_service", values: ["Quarterly window cleaning"] },
    { name: "sms_consent", values: ["Yes"] },
  ],
};

describe("Meta Lead Ads normalization", () => {
  it("extracts and deduplicates leadgen references", () => {
    const raw = JSON.stringify({
      object: "page",
      entry: [{
        id: "page-1",
        changes: [
          { field: "leadgen", value: { leadgen_id: "lead-123", form_id: "form-1" } },
          { field: "leadgen", value: { leadgen_id: "lead-123", form_id: "form-1" } },
        ],
      }],
    });
    expect(parseMetaLeadWebhookPayload(raw)).toEqual([reference]);
    expect(parseMetaLeadWebhookPayload("not-json")).toBeNull();
  });

  it("records explicit consent only for an approved form and disclosure", () => {
    const input = metaLeadToIntakeInput({
      reference,
      details,
      consent: {
        approvedFormIds: new Set(["form-1"]),
        consentFieldNames: new Set(["sms_consent"]),
        disclosureVersion: "meta-form-1-sms-v1",
      },
    });
    expect(input).toMatchObject({
      source: "facebook_lead_ad",
      externalLeadId: "lead-123",
      name: "Jamie Smith",
      phone: "+15305550199",
      preferredContactMethod: "Text",
      smsConsentStatus: "opted_in",
      smsConsentDisclosureVersion: "meta-form-1-sms-v1",
      sourceCampaignName: "Chico memberships",
      servicesInterested: ["Window Cleaning", "Full Home Care Membership"],
    });
  });

  it("fails closed when the same yes answer comes from an unapproved form", () => {
    const input = metaLeadToIntakeInput({
      reference,
      details,
      consent: {
        approvedFormIds: new Set(["different-form"]),
        consentFieldNames: new Set(["sms_consent"]),
        disclosureVersion: "meta-form-sms-v1",
      },
    });
    expect(input).toMatchObject({
      preferredContactMethod: "Phone",
      smsConsentStatus: "unknown",
      smsConsentDisclosureVersion: null,
    });
  });
});
