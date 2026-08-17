import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateLeadIntakeInput } from "../lead-record";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: () => true,
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServerSupabaseClient: () => ({ from: mocks.from }),
}));

import { createLeadIntake } from "./repository";

const SUBMISSION_ID = "00000000-0000-4000-8000-000000000081";
const existingRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Retry Safe Homeowner",
  phone: "530-555-0181",
  email: "safe@example.com",
  service_address: "181 Safe Request Way, Chico, CA",
  services_interested: ["Window Cleaning"],
  preferred_contact_method: "Phone",
  sms_consent_status: "unknown",
  sms_consent_recorded_at: null,
  notes: "",
  membership_tier: "quarterly",
  square_footage: 2400,
  estimated_visit_price: 249,
  preferred_start_window: "Within 2 weeks",
  status: "new",
  submitted_at: "2026-08-16T20:00:00.000Z",
  source: "request_form",
  client_submission_id: SUBMISSION_ID,
  external_lead_id: null,
  source_page_id: null,
  source_form_id: null,
  source_campaign_id: null,
  source_campaign_name: null,
  source_adset_id: null,
  source_adset_name: null,
  source_ad_id: null,
  source_ad_name: null,
};

const input: CreateLeadIntakeInput = {
  name: existingRow.name,
  phone: existingRow.phone,
  email: existingRow.email,
  serviceAddress: existingRow.service_address,
  servicesInterested: ["Window Cleaning"],
  preferredContactMethod: "Phone" as const,
  smsConsentStatus: "unknown" as const,
  notes: "",
  membershipTier: "quarterly" as const,
  squareFootage: 2400,
  estimatedVisitPrice: 249,
  preferredStartWindow: existingRow.preferred_start_window,
  clientSubmissionId: SUBMISSION_ID,
};

function lookupResult(data: typeof existingRow | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe("lead repository request-form idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the original lead before insert when the retry key exists", async () => {
    const lookup = lookupResult(existingRow);
    mocks.from.mockReturnValueOnce(lookup);

    const result = await createLeadIntake(input);

    expect(result).toMatchObject({
      storage: "supabase",
      duplicate: true,
      record: {
        id: existingRow.id,
        clientSubmissionId: SUBMISSION_ID,
      },
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(lookup.eq).toHaveBeenCalledWith(
      "client_submission_id",
      SUBMISSION_ID,
    );
  });

  it("recovers the winning row when concurrent inserts hit uniqueness", async () => {
    const initialLookup = lookupResult(null);
    const insert = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23505", message: "unique violation" },
      }),
    };
    insert.insert.mockReturnValue(insert);
    insert.select.mockReturnValue(insert);
    const racedLookup = lookupResult(existingRow);
    mocks.from
      .mockReturnValueOnce(initialLookup)
      .mockReturnValueOnce(insert)
      .mockReturnValueOnce(racedLookup);

    const result = await createLeadIntake(input);

    expect(result).toMatchObject({
      storage: "supabase",
      duplicate: true,
      record: { id: existingRow.id },
    });
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ client_submission_id: SUBMISSION_ID }),
    );
    expect(mocks.from).toHaveBeenCalledTimes(3);
  });
});
