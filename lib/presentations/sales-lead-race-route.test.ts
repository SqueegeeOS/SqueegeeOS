import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeSalesRequest: vi.fn(),
  canSalesActorAccessRep: vi.fn(),
  createPresentation: vi.fn(),
  findAuthoritativePresentationForLeadIntake: vi.fn(),
  findAuthoritativePresentationForSalesLead: vi.fn(),
  listPresentations: vi.fn(),
  patchPresentation: vi.fn(),
  getLeadIntakeById: vi.fn(),
  updateLeadIntakeStatus: vi.fn(),
  resolvePresentationSalesLineage: vi.fn(),
  markSalesLeadPresentationCreated: vi.fn(),
  loadLeadIntakeSalesAssignment: vi.fn(),
}));

vi.mock("@/lib/sales/sales-access", () => ({
  authorizeSalesRequest: mocks.authorizeSalesRequest,
  canSalesActorAccessRep: mocks.canSalesActorAccessRep,
}));

vi.mock("@/lib/presentations/repository", () => ({
  createPresentation: mocks.createPresentation,
  findAuthoritativePresentationForLeadIntake:
    mocks.findAuthoritativePresentationForLeadIntake,
  findAuthoritativePresentationForSalesLead:
    mocks.findAuthoritativePresentationForSalesLead,
  listPresentations: mocks.listPresentations,
  patchPresentation: mocks.patchPresentation,
}));

vi.mock("@/lib/acquisition/leads/repository", () => ({
  getLeadIntakeById: mocks.getLeadIntakeById,
  updateLeadIntakeStatus: mocks.updateLeadIntakeStatus,
}));

vi.mock("@/lib/sales/workspace-server", () => {
  class SalesWorkspaceActionError extends Error {
    status = 409;
  }
  class SalesWorkspaceUnavailableError extends Error {}
  return {
    resolvePresentationSalesLineage: mocks.resolvePresentationSalesLineage,
    markSalesLeadPresentationCreated: mocks.markSalesLeadPresentationCreated,
    SalesWorkspaceActionError,
    SalesWorkspaceUnavailableError,
  };
});

vi.mock("@/lib/sales/lead-intake-assignment-server", () => {
  class LeadIntakeAssignmentError extends Error {
    status = 409;
  }
  return {
    loadLeadIntakeSalesAssignment: mocks.loadLeadIntakeSalesAssignment,
    LeadIntakeAssignmentError,
  };
});

import { POST } from "@/app/api/presentations/route";

const REP_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "22222222-2222-4222-8222-222222222222";
const PRESENTATION_ID = "33333333-3333-4333-8333-333333333333";
const INTAKE_ID = "44444444-4444-4444-8444-444444444444";

describe("field lead presentation two-tab race", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeSalesRequest.mockResolvedValue({
      kind: "admin",
      displayName: "HomeAtlas HQ",
      grantId: null,
      repId: null,
      repSlug: null,
      sessionExpiresAt: null,
    });
    mocks.canSalesActorAccessRep.mockReturnValue(true);
    mocks.resolvePresentationSalesLineage.mockResolvedValue({
      id: REP_ID,
      slug: "david",
      displayName: "David",
      compensationPlan: "founding_david",
      leadId: LEAD_ID,
      lead: {
        id: LEAD_ID,
        leadIntakeId: null,
        fullName: "Rehearsal Homeowner",
        propertyAddress: "100 Safe Test Way",
        phone: null,
        email: null,
        serviceInterests: ["exterior_windows", "screens"],
      },
    });
    mocks.findAuthoritativePresentationForSalesLead
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: PRESENTATION_ID,
        status: "draft",
        updatedAt: "2026-08-16T18:00:00.000Z",
      });
    mocks.createPresentation.mockRejectedValue(
      new Error("duplicate key value violates unique constraint"),
    );
    mocks.markSalesLeadPresentationCreated.mockResolvedValue(undefined);
    mocks.loadLeadIntakeSalesAssignment.mockResolvedValue(null);
  });

  it("returns the presentation created by the winning tab instead of failing or duplicating", async () => {
    const request = new Request("https://example.test/api/presentations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repSlug: "david", salesRepLeadId: LEAD_ID }),
    }) as NextRequest;

    const response = await POST(request);
    const body = (await response.json()) as {
      presentation?: { id?: string };
      resumed?: boolean;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      resumed: true,
      presentation: { id: PRESENTATION_ID },
    });
    expect(mocks.findAuthoritativePresentationForSalesLead).toHaveBeenCalledTimes(
      2,
    );
    expect(mocks.createPresentation).toHaveBeenCalledTimes(1);
    expect(mocks.createPresentation).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceInterests: ["exterior_windows", "screens"],
      }),
    );
    expect(mocks.markSalesLeadPresentationCreated).toHaveBeenCalledWith({
      repId: REP_ID,
      leadId: LEAD_ID,
    });
  });

  it("creates one intake-originated presentation with exact rep attribution", async () => {
    mocks.getLeadIntakeById.mockResolvedValue({
      id: INTAKE_ID,
      name: "Website Homeowner",
      phone: "+15305550123",
      email: "website@example.com",
      serviceAddress: "1420 Davis Street",
      servicesInterested: ["Window Cleaning"],
      preferredContactMethod: "Phone",
      smsConsentStatus: "unknown",
      smsConsentRecordedAt: null,
      notes: "",
      membershipTier: "quarterly",
      squareFootage: 2200,
      estimatedVisitPrice: 249,
      preferredStartWindow: null,
      status: "new",
      submittedAt: "2026-08-16T18:00:00.000Z",
      source: "request_form",
      externalLeadId: null,
      sourcePageId: null,
      sourceFormId: null,
      sourceCampaignId: null,
      sourceCampaignName: null,
      sourceAdsetId: null,
      sourceAdsetName: null,
      sourceAdId: null,
      sourceAdName: null,
    });
    mocks.loadLeadIntakeSalesAssignment.mockResolvedValue({
      salesRepLeadId: LEAD_ID,
      leadIntakeId: INTAKE_ID,
      repId: REP_ID,
      repSlug: "david",
      repDisplayName: "David",
      repWorkspacePath: "/david",
      status: "follow_up",
      source: "request_form",
      nextFollowUpAt: "2026-08-17T18:00:00.000Z",
      createdAt: "2026-08-16T18:00:00.000Z",
      updatedAt: "2026-08-16T18:00:00.000Z",
    });
    mocks.resolvePresentationSalesLineage.mockResolvedValue({
      id: REP_ID,
      slug: "david",
      displayName: "David",
      compensationPlan: "founding_david",
      leadId: LEAD_ID,
      lead: {
        id: LEAD_ID,
        leadIntakeId: INTAKE_ID,
        fullName: "Website Homeowner",
        propertyAddress: "1420 Davis Street",
        phone: "+15305550123",
        email: "website@example.com",
      },
    });
    mocks.findAuthoritativePresentationForLeadIntake.mockResolvedValue(null);
    mocks.createPresentation.mockResolvedValue({
      id: PRESENTATION_ID,
      status: "draft",
    });
    mocks.updateLeadIntakeStatus.mockResolvedValue({ status: "scheduled" });

    const request = new Request("https://example.test/api/presentations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIntakeId: INTAKE_ID }),
    }) as NextRequest;
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mocks.createPresentation).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "Website Homeowner",
        salesRepId: REP_ID,
        salesRepLeadId: null,
        leadIntakeId: INTAKE_ID,
      }),
    );
    expect(mocks.markSalesLeadPresentationCreated).toHaveBeenCalledWith({
      repId: REP_ID,
      leadId: LEAD_ID,
    });
  });

  it("does not let a phone pass open an arbitrary intake reference", async () => {
    mocks.authorizeSalesRequest.mockResolvedValue({
      kind: "sales_rep",
      displayName: "David",
      grantId: "grant-1",
      repId: REP_ID,
      repSlug: "david",
      sessionExpiresAt: "2026-09-16T18:00:00.000Z",
    });
    const request = new Request("https://example.test/api/presentations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repSlug: "david", leadIntakeId: INTAKE_ID }),
    }) as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mocks.getLeadIntakeById).not.toHaveBeenCalled();
    expect(mocks.loadLeadIntakeSalesAssignment).not.toHaveBeenCalled();
  });
});
