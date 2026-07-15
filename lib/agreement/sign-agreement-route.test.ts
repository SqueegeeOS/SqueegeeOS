import { beforeEach, describe, expect, it, vi } from "vitest";

const PRESENTATION_ID = "43f4f95d-cae4-4f68-b672-29d56d6f7b5f";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const mocks = vi.hoisted(() => ({
  getPresentation: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("@/lib/presentations/repository", () => ({
  getPresentationByCapability: mocks.getPresentation,
}));
vi.mock("@/lib/membership/complete-sign-onboarding", () => ({
  completeSignOnboarding: mocks.complete,
  SignOnboardingError: class SignOnboardingError extends Error {
    partial?: Record<string, string>;
  },
  SignOnboardingConflictError: class SignOnboardingConflictError extends Error {},
  SignOnboardingInputError: class SignOnboardingInputError extends Error {},
}));

import { POST } from "../../app/api/sign-agreement/route";
import { SignOnboardingConflictError } from "@/lib/membership/complete-sign-onboarding";

function request(body: Record<string, unknown>) {
  return new Request("https://homeatlas.example/api/sign-agreement", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("public sign-agreement route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPresentation.mockResolvedValue({
      id: PRESENTATION_ID,
      status: "presented",
      tier: "quarterly",
    });
    mocks.complete.mockResolvedValue({
      pdfUrl: "storage:signed-agreements/agreement.pdf",
      pdfStorageBackend: "supabase",
      agreementId: "agreement-id",
      membershipId: "membership-id",
      homeownerId: "homeowner-id",
      propertyId: "property-id",
      emailSent: false,
      email: { status: "skipped", reason: "no_valid_recipient_email" },
      onboardingStatus: "pending_payment",
      portalUrl: "/portal/capability",
    });
  });

  it("resolves the capability and delegates only server-derived domain input", async () => {
    const response = await POST(
      request({
        presentationId: PRESENTATION_ID,
        agreementTier: "quarterly",
        signatureDataUrl: PNG,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPresentation).toHaveBeenCalledWith(PRESENTATION_ID);
    expect(mocks.complete).toHaveBeenCalledOnce();
    const input = mocks.complete.mock.calls[0][0];
    expect(input).toMatchObject({
      presentation: expect.objectContaining({ id: PRESENTATION_ID }),
      agreementTier: "quarterly",
      signatureDataUrl: PNG,
    });
    expect(input).not.toHaveProperty("visitPrice");
    expect(input).not.toHaveProperty("homeownerSlug");
    expect(input).not.toHaveProperty("membershipId");
    expect(input).not.toHaveProperty("signedAt");
  });

  it("rejects client-supplied price or linkage before capability lookup", async () => {
    const response = await POST(
      request({
        presentationId: PRESENTATION_ID,
        agreementTier: "quarterly",
        signatureDataUrl: PNG,
        monthlyPrice: 1,
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.getPresentation).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("rejects malformed PNG evidence before capability lookup and permits a valid retry", async () => {
    const malformed = await POST(
      request({
        presentationId: PRESENTATION_ID,
        agreementTier: "quarterly",
        signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      }),
    );
    expect(malformed.status).toBe(400);
    expect(mocks.getPresentation).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();

    const retry = await POST(
      request({
        presentationId: PRESENTATION_ID,
        agreementTier: "quarterly",
        signatureDataUrl: PNG,
      }),
    );
    expect(retry.status).toBe(200);
    expect(mocks.getPresentation).toHaveBeenCalledOnce();
    expect(mocks.complete).toHaveBeenCalledOnce();
  });

  it("enforces the streamed body byte limit without Content-Length", async () => {
    const bytes = new TextEncoder().encode("x".repeat(600_000));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const response = await POST(
      new Request("https://homeatlas.example/api/sign-agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );
    expect(response.status).toBe(400);
    expect(mocks.getPresentation).not.toHaveBeenCalled();
  });

  it("fails closed for a missing capability record", async () => {
    mocks.getPresentation.mockResolvedValue(null);
    const response = await POST(
      request({
        presentationId: PRESENTATION_ID,
        agreementTier: "quarterly",
        signatureDataUrl: PNG,
      }),
    );
    expect(response.status).toBe(404);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("rejects a retry that conflicts with the immutable signed tier", async () => {
    mocks.complete.mockRejectedValue(
      new SignOnboardingConflictError("Signing evidence requires review"),
    );
    const response = await POST(
      request({
        presentationId: PRESENTATION_ID,
        agreementTier: "quarterly",
        signatureDataUrl: PNG,
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.complete).toHaveBeenCalledOnce();
  });
});
