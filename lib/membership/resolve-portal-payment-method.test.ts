import { describe, expect, it, vi, beforeEach } from "vitest";

const retrieveMock = vi.fn();

vi.mock("@/lib/stripe/config", () => ({
  isStripeServerEnabled: () => true,
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    paymentMethods: {
      retrieve: retrieveMock,
    },
  }),
}));

describe("resolvePortalPaymentMethodLabel", () => {
  beforeEach(() => {
    retrieveMock.mockReset();
  });

  it("formats card brand and last4", async () => {
    retrieveMock.mockResolvedValue({
      type: "card",
      card: { brand: "visa", last4: "4242" },
    });

    const { resolvePortalPaymentMethodLabel } = await import(
      "./resolve-portal-payment-method"
    );
    await expect(resolvePortalPaymentMethodLabel("pm_card")).resolves.toBe(
      "Visa ···· 4242",
    );
  });

  it("formats bank account last4", async () => {
    retrieveMock.mockResolvedValue({
      type: "us_bank_account",
      us_bank_account: { last4: "6789", bank_name: "Chase" },
    });

    const { resolvePortalPaymentMethodLabel } = await import(
      "./resolve-portal-payment-method"
    );
    await expect(resolvePortalPaymentMethodLabel("pm_bank")).resolves.toBe(
      "Bank account ···· 6789",
    );
  });

  it("falls back for bank account without last4", async () => {
    retrieveMock.mockResolvedValue({
      type: "us_bank_account",
      us_bank_account: {},
    });

    const { resolvePortalPaymentMethodLabel } = await import(
      "./resolve-portal-payment-method"
    );
    await expect(resolvePortalPaymentMethodLabel("pm_bank")).resolves.toBe(
      "Bank account on file",
    );
  });
});
