import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  list: vi.fn(),
  reconcileEnrollmentSetupIntent: vi.fn(),
  reconcileHostedMembershipSetupIntent: vi.fn(),
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServiceRoleSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  }),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({ setupIntents: { list: mocks.list } }),
}));

vi.mock("@/lib/enrollment/reconcile-stripe-setup", () => ({
  reconcileEnrollmentSetupIntent: mocks.reconcileEnrollmentSetupIntent,
}));

vi.mock("./reconcile-hosted-payment-setup", () => ({
  reconcileHostedMembershipSetupIntent:
    mocks.reconcileHostedMembershipSetupIntent,
}));

import { reconcileExistingStripeSetup } from "./reconcile-existing-stripe-setup";

const MEMBERSHIP_ID = "22222222-2222-4222-8222-222222222222";

describe("reconcileExistingStripeSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: MEMBERSHIP_ID,
        status: "pending_payment",
        stripe_customer_id: "cus_existing",
        stripe_payment_method_id: null,
        payment_setup_completed_at: null,
      },
      error: null,
    });
    mocks.reconcileEnrollmentSetupIntent.mockResolvedValue("processed");
    mocks.reconcileHostedMembershipSetupIntent.mockResolvedValue("processed");
  });

  it("replays a missed enrollment success for the same membership", async () => {
    const intent = {
      id: "seti_existing",
      status: "succeeded",
      metadata: {
        homeatlas_operation: "membership_enrollment_setup",
        membership_id: MEMBERSHIP_ID,
      },
    };
    mocks.list.mockResolvedValue({ data: [intent] });

    await expect(reconcileExistingStripeSetup(MEMBERSHIP_ID)).resolves.toEqual({
      setupIntentId: "seti_existing",
      operation: "membership_enrollment_setup",
    });
    expect(mocks.list).toHaveBeenCalledWith({
      customer: "cus_existing",
      limit: 25,
    });
    expect(mocks.reconcileEnrollmentSetupIntent).toHaveBeenCalledWith(intent);
    expect(mocks.reconcileHostedMembershipSetupIntent).not.toHaveBeenCalled();
  });

  it("does not match a successful setup belonging to another membership", async () => {
    mocks.list.mockResolvedValue({
      data: [
        {
          id: "seti_other",
          status: "succeeded",
          metadata: {
            homeatlas_operation: "membership_enrollment_setup",
            membership_id: "another-membership",
          },
        },
      ],
    });

    await expect(reconcileExistingStripeSetup(MEMBERSHIP_ID)).resolves.toBeNull();
    expect(mocks.reconcileEnrollmentSetupIntent).not.toHaveBeenCalled();
  });
});
