import { describe, expect, it } from "vitest";
import { createDefaultPresentation } from "./repository";
import {
  createPresentationDraftPayload,
  restorePresentationDraftPayload,
} from "./draft-persistence";

describe("presentation draft persistence", () => {
  it("round-trips every editable presentation field", () => {
    const base = createDefaultPresentation({
      clientName: "Original",
      homeSqft: 1800,
    });
    const edited = {
      ...base,
      clientName: "Saved customer",
      clientAddress: "123 Test Street, Chico",
      clientEmail: "customer@example.com",
      homeSqft: 3210,
      twoStory: true,
      includeScreens: true,
      includeInterior: true,
      tier: "biannual" as const,
      monthlyRate: 375,
      overrideTier: "biannual" as const,
      visitRateOverrides: { biannual: 375, quarterly: 290 },
      retailValue: 725,
      enrollmentSavings: 125,
      customNotes: "Remember this closing note.",
      quoteSnapshot: {
        sqft: 3210,
        frequency: "bi_annual" as const,
        includeInterior: true,
        twoStory: true,
        includeScreens: true,
        windowCareVisitPrice: 375,
        frequencyLabel: "Twice per year",
        exteriorAddOnQuote: {
          lineItems: [],
          subtotal: 80,
          listSubtotal: 100,
          memberDiscountPercent: 20,
          memberSavings: 20,
        },
        totalEstimate: 455,
      },
      slideOverrides: {
        cover: { headline: "A custom welcome" },
        close: { body: "A custom close" },
      },
    };

    const restored = restorePresentationDraftPayload(
      createDefaultPresentation({ clientName: "Empty" }),
      createPresentationDraftPayload(edited),
    );

    expect(createPresentationDraftPayload(restored)).toEqual(
      createPresentationDraftPayload(edited),
    );
  });

  it("never lets a draft payload rewrite record identity or lifecycle", () => {
    const base = {
      ...createDefaultPresentation({ clientName: "Safe" }),
      id: "server-id",
      status: "signed" as const,
      agreementId: "agreement-id",
    };

    const restored = restorePresentationDraftPayload(base, {
      id: "attacker-id",
      status: "draft",
      agreementId: null,
      clientName: "Recovered editor value",
    });

    expect(restored.id).toBe("server-id");
    expect(restored.status).toBe("signed");
    expect(restored.agreementId).toBe("agreement-id");
    expect(restored.clientName).toBe("Recovered editor value");
  });

  it("restores the optional 3x/year tier and its scoped rate", () => {
    const base = createDefaultPresentation({ clientName: "Three visit customer" });
    const restored = restorePresentationDraftPayload(base, {
      tier: "triannual",
      monthlyRate: 285,
      overrideTier: "triannual",
      visitRateOverrides: { triannual: 285 },
    });

    expect(restored.tier).toBe("triannual");
    expect(restored.overrideTier).toBe("triannual");
    expect(restored.visitRateOverrides?.triannual).toBe(285);
  });
});
