import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PresentationData } from "@/lib/presentations/types";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  createServiceRoleSupabaseClient: mocks.createServiceClient,
}));
vi.mock("@/lib/membership/signing-coherence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/membership/signing-coherence")>()),
  verifiedPresentationAuthority: () => "a".repeat(64),
}));

import {
  completeSignOnboarding,
  SignOnboardingInputError,
} from "./complete-sign-onboarding";

const presentation = { id: "43f4f95d-cae4-4f68-b672-29d56d6f7b5f" } as PresentationData;
const validPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("signing evidence mutation ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "intentional test stop after claim boundary" },
    });
    mocks.createServiceClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("does not claim or create service mutation authority for malformed evidence, then permits a valid retry", async () => {
    await expect(
      completeSignOnboarding({
        presentation,
        agreementTier: "quarterly",
        signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      }),
    ).rejects.toBeInstanceOf(SignOnboardingInputError);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();

    await expect(
      completeSignOnboarding({
        presentation,
        agreementTier: "quarterly",
        signatureDataUrl: validPng,
      }),
    ).rejects.toThrow("Failed to claim signing attempt");
    expect(mocks.createServiceClient).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "claim_presentation_signing_attempt",
      expect.any(Object),
    );
  });
});
