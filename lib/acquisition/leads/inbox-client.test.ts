import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeadIntakeRecord } from "../lead-record";
import { schedulePresentationFromLead } from "./inbox-client";

const lead: LeadIntakeRecord = {
  id: "24df6335-227d-41ce-9cac-021799314c51",
  name: "Mandi Example",
  phone: "530-555-0101",
  email: "mandi@example.com",
  serviceAddress: "1420 Davis Street, Chico, CA 95928",
  servicesInterested: ["Window Cleaning"],
  preferredContactMethod: "Text",
  smsConsentStatus: "opted_in",
  smsConsentRecordedAt: "2026-08-14T12:00:00.000Z",
  notes: "Gate code stays private",
  membershipTier: "quarterly",
  squareFootage: 2400,
  estimatedVisitPrice: 250,
  preferredStartWindow: null,
  status: "new",
  submittedAt: "2026-08-14T12:00:00.000Z",
  source: "request_form",
  clientSubmissionId: "00000000-0000-4000-8000-000000000081",
  externalLeadId: null,
  sourcePageId: null,
  sourceFormId: null,
  sourceCampaignId: null,
  sourceCampaignName: null,
  sourceAdsetId: null,
  sourceAdsetName: null,
  sourceAdId: null,
  sourceAdName: null,
};

describe("schedulePresentationFromLead", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends only stable inquiry lineage and opens the editable record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          presentation: { id: "presentation-1", status: "draft" },
          resumed: false,
          leadStatusSynced: true,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(schedulePresentationFromLead(lead)).resolves.toBe(
      "/presentations/presentation-1/edit",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/presentations");
    expect(request.method).toBe("POST");
    expect(JSON.parse(String(request.body))).toEqual({
      leadIntakeId: lead.id,
    });
  });

  it("opens an authoritative signed outcome and preserves a sync warning", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            presentation: { id: "presentation-2", status: "signed" },
            resumed: true,
            leadStatusSynced: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(schedulePresentationFromLead(lead)).resolves.toBe(
      "/presentations/presentation-2/present?inquirySync=pending",
    );
  });

  it("surfaces the server-owned repair instruction", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: "Restore this archived inquiry first." }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(schedulePresentationFromLead(lead)).rejects.toThrow(
      "Restore this archived inquiry first.",
    );
  });
});
