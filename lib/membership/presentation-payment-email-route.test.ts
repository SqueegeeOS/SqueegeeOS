import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeSalesPresentationRequest: vi.fn(),
  getPresentation: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  sendHostedMembershipPaymentLink: vi.fn(),
}));

vi.mock("@/lib/sales/sales-access", () => ({
  authorizeSalesPresentationRequest:
    mocks.authorizeSalesPresentationRequest,
}));

vi.mock("@/lib/presentations/repository", () => ({
  getPresentation: mocks.getPresentation,
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));

vi.mock("@/lib/membership/hosted-payment-handoff", () => ({
  sendHostedMembershipPaymentLink: mocks.sendHostedMembershipPaymentLink,
}));

import { POST } from "@/app/api/presentations/[id]/send-payment-link/route";

const PRESENTATION_ID = "11111111-1111-4111-8111-111111111111";
const MEMBERSHIP_ID = "22222222-2222-4222-8222-222222222222";

function request(body?: unknown) {
  return new Request(
    `https://www.squeegeeking.net/api/presentations/${PRESENTATION_ID}/send-payment-link`,
    {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}

function context() {
  return { params: Promise.resolve({ id: PRESENTATION_ID }) };
}

describe("presentation payment email route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeSalesPresentationRequest.mockResolvedValue({
      kind: "sales_rep",
      displayName: "David",
      grantId: "33333333-3333-4333-8333-333333333333",
      repId: "44444444-4444-4444-8444-444444444444",
      repSlug: "david",
      sessionExpiresAt: "2026-08-17T12:00:00.000Z",
    });
    mocks.isSupabaseConfigured.mockReturnValue(true);
    mocks.getPresentation.mockResolvedValue({
      id: PRESENTATION_ID,
      status: "signed",
      membershipId: MEMBERSHIP_ID,
    });
    mocks.sendHostedMembershipPaymentLink.mockResolvedValue({
      status: "sent",
      recipientMasked: "c***@example.com",
      expiresAt: "2026-08-17T12:00:00.000Z",
      checkoutSessionId: "cs_test_safe",
    });
  });

  it("rejects callers who do not own the presentation before reading customer data", async () => {
    mocks.authorizeSalesPresentationRequest.mockResolvedValue(null);

    const response = await POST(request(), context());

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(mocks.getPresentation).not.toHaveBeenCalled();
    expect(mocks.sendHostedMembershipPaymentLink).not.toHaveBeenCalled();
  });

  it("requires a signed presentation with a durable membership binding", async () => {
    mocks.getPresentation.mockResolvedValue({
      id: PRESENTATION_ID,
      status: "presented",
      membershipId: null,
    });

    const response = await POST(request(), context());

    expect(response.status).toBe(409);
    expect(mocks.sendHostedMembershipPaymentLink).not.toHaveBeenCalled();
  });

  it("derives the membership server-side and attributes a field send to its rep", async () => {
    const response = await POST(
      request({ membershipId: "spoofed-membership-id" }),
      context(),
    );
    const body = (await response.json()) as { message?: string };

    expect(response.status).toBe(200);
    expect(body.message).toBe(
      "Stripe setup email accepted for c***@example.com.",
    );
    expect(mocks.sendHostedMembershipPaymentLink).toHaveBeenCalledWith({
      membershipId: MEMBERSHIP_ID,
      requestOrigin: "https://www.squeegeeking.net",
      actor: "sales_rep:david",
    });
  });

  it("attributes an HQ send to the admin actor", async () => {
    mocks.authorizeSalesPresentationRequest.mockResolvedValue({
      kind: "admin",
      displayName: "HomeAtlas HQ",
      grantId: null,
      repId: null,
      repSlug: null,
      sessionExpiresAt: null,
    });

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(mocks.sendHostedMembershipPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "homeatlas_hq" }),
    );
  });
});
