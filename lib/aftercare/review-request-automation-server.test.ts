import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ruleEnabled: true,
  consentStatus: "opted_in" as "opted_in" | "unknown" | "opted_out",
  verificationStatus: "verified" as "verified" | "unverified" | "invalid",
  snapshot: vi.fn(),
  ensureConversation: vi.fn(),
  loadContext: vi.fn(),
  send: vi.fn(),
  resolveOutcome: vi.fn(),
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({
          data: {
            id: "review_request_after_visit_sms",
            enabled: mocks.ruleEnabled,
            consent_required: true,
            verified_contact_required: true,
          },
          error: null,
        })),
      };
      return builder;
    }),
  })),
}));

vi.mock("@/lib/communications/provider-readiness", () => ({
  getCommunicationAutomationReadiness: vi.fn(async () => ({
    ready: true,
    reason: null,
  })),
}));

vi.mock("@/lib/communications/service", () => ({
  getCommunicationsConfiguration: vi.fn(() => ({
    email: { configured: true, fromLabel: null, detail: "" },
    sms: { configured: true, fromLabel: null, detail: "" },
  })),
  sendOutboundCommunication: mocks.send,
}));

vi.mock("@/lib/communications/repository", () => ({
  ensureHomeownerConversation: mocks.ensureConversation,
  loadCommunicationConversationContext: mocks.loadContext,
}));

vi.mock("@/lib/reviews/review-request-url-server", () => ({
  resolveGoogleReviewRequestUrl: vi.fn(async () =>
    "https://search.google.com/local/writereview?placeid=ChIJ_example",
  ),
}));

vi.mock("./customer-aftercare-server", () => ({
  loadCustomerAftercareSnapshot: mocks.snapshot,
}));

vi.mock("./customer-aftercare-actions-server", () => ({
  recordCustomerAftercareOutcome: mocks.resolveOutcome,
}));

const task = {
  taskKey: "review-opportunity:55555555-5555-4555-8555-555555555555",
  type: "review_opportunity" as const,
  homeownerId: "11111111-1111-4111-8111-111111111111",
  propertyId: "22222222-2222-4222-8222-222222222222",
  membershipId: "33333333-3333-4333-8333-333333333333",
  appointmentId: "55555555-5555-4555-8555-555555555555",
  homeownerName: "Morgan Example",
  propertyLabel: "123 Main St",
  dueAt: "2026-07-11T17:00:00.000Z",
  evidenceAt: "2026-07-10T17:00:00.000Z",
  serviceLabel: "Exterior Window Cleaning",
  completedAt: "2026-07-10T17:00:00.000Z",
  customerSummaryVisible: true,
  customerPhotoVisible: true,
};

describe("completed-visit review request processor", () => {
  beforeEach(() => {
    mocks.ruleEnabled = true;
    mocks.consentStatus = "opted_in";
    mocks.verificationStatus = "verified";
    mocks.snapshot.mockReset().mockResolvedValue({
      generatedAt: "2026-07-12T18:00:00.000Z",
      serviceCases: [],
      tasks: [task],
      truncated: false,
    });
    mocks.ensureConversation.mockReset().mockResolvedValue({ id: "conversation-1" });
    mocks.loadContext.mockReset().mockImplementation(async () => ({
      customerName: "Morgan Example",
      sms: {
        address: "+15555550123",
        consentStatus: mocks.consentStatus,
        verificationStatus: mocks.verificationStatus,
      },
    }));
    mocks.send.mockReset().mockResolvedValue({
      duplicate: false,
      message: { deliveryStatus: "queued" },
    });
    mocks.resolveOutcome.mockReset().mockResolvedValue({
      duplicate: false,
      record: {},
    });
  });

  it("sends once and closes the review opportunity only after Twilio accepts it", async () => {
    const { processEligibleReviewRequests } = await import(
      "./review-request-automation-server"
    );
    const summary = await processEligibleReviewRequests(
      new Date("2026-07-12T18:00:00.000Z"),
    );

    expect(summary).toMatchObject({
      state: "active",
      candidates: 1,
      sent: 1,
      resolved: 1,
      failed: 0,
    });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "sms",
        idempotencyKey:
          "appointment:55555555-5555-4555-8555-555555555555:review-request:sms:v1",
      }),
    );
    expect(mocks.resolveOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "review_requested" }),
      new Date("2026-07-12T18:00:00.000Z"),
    );
  });

  it("does nothing until the founder-controlled rule is enabled", async () => {
    mocks.ruleEnabled = false;
    const { processEligibleReviewRequests } = await import(
      "./review-request-automation-server"
    );
    const summary = await processEligibleReviewRequests(
      new Date("2026-07-12T18:00:00.000Z"),
    );

    expect(summary.state).toBe("off");
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("keeps an eligible visit queued when customer SMS consent is not active", async () => {
    mocks.consentStatus = "unknown";
    const { processEligibleReviewRequests } = await import(
      "./review-request-automation-server"
    );
    const summary = await processEligibleReviewRequests(
      new Date("2026-07-12T18:00:00.000Z"),
    );

    expect(summary).toMatchObject({ candidates: 1, skipped: 1, resolved: 0 });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.resolveOutcome).not.toHaveBeenCalled();
  });
});
