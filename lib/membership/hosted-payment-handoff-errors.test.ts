import { describe, expect, it } from "vitest";
import { publicHostedPaymentHandoffError } from "./hosted-payment-handoff-errors";

describe("public hosted payment handoff errors", () => {
  it("preserves expected operator-safe recovery messages", () => {
    expect(
      publicHostedPaymentHandoffError(
        new Error("Completed standing billing authorization is required."),
      ),
    ).toEqual({
      message: "Completed standing billing authorization is required.",
      status: 409,
    });
  });

  it("reports unavailable Stripe configuration without exposing internals", () => {
    expect(
      publicHostedPaymentHandoffError(
        new Error("Stripe is not configured for hosted card setup."),
      ),
    ).toEqual({
      message: "Stripe is not configured for hosted card setup.",
      status: 503,
    });
  });

  it("redacts unexpected provider and database failures", () => {
    const safe = publicHostedPaymentHandoffError(
      new Error("postgres secret detail and provider payload"),
    );

    expect(safe.status).toBe(500);
    expect(safe.message).toBe(
      "The secure card setup email could not be sent. Review production health and try again.",
    );
    expect(safe.message).not.toContain("postgres");
    expect(safe.message).not.toContain("provider payload");
  });
});
