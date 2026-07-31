import { describe, expect, it } from "vitest";
import {
  buildCareOpportunities,
  buildExceptionCodes,
  buildJourneyActions,
  buildJourneyStages,
  journeyCompletionPercent,
  scoreCustomerMatch,
} from "./atlas-pulse-model";

describe("Atlas Pulse journey", () => {
  it("shows a complete eight-step activation", () => {
    const stages = buildJourneyStages({
      hasLead: true,
      hasPresentation: true,
      hasAgreement: true,
      paymentReady: true,
      portalUrl: "https://www.squeegeeking.net/portal/token",
      welcomeDeliveryStatus: "delivered",
      manualEmailComplete: true,
      manualPortalComplete: true,
      jobberLinked: true,
      visitScheduled: true,
    });

    expect(journeyCompletionPercent(stages)).toBe(100);
    expect(buildExceptionCodes(stages)).toEqual([]);
  });

  it("keeps an accepted email visible until delivery is confirmed", () => {
    const stages = buildJourneyStages({
      hasLead: true,
      hasPresentation: true,
      hasAgreement: true,
      paymentReady: true,
      portalUrl: "https://www.squeegeeking.net/portal/token",
      welcomeDeliveryStatus: "accepted",
      jobberLinked: false,
      visitScheduled: false,
    });

    expect(stages.find((stage) => stage.id === "portal")?.status).toBe(
      "attention",
    );
    expect(buildExceptionCodes(stages)).toEqual(["email", "portal", "jobber"]);
  });

  it("keeps provider evidence separate from a founder-confirmed handoff", () => {
    const stages = buildJourneyStages({
      hasLead: true,
      hasPresentation: true,
      hasAgreement: true,
      paymentReady: true,
      portalUrl: "https://www.squeegeeking.net/portal/token",
      welcomeDeliveryStatus: "accepted",
      manualEmailComplete: true,
      manualPortalComplete: true,
      jobberLinked: false,
      visitScheduled: false,
    });

    expect(stages.find((stage) => stage.id === "email")).toMatchObject({
      status: "complete",
      detail: "Founder confirmed the email handoff",
    });
    expect(stages.find((stage) => stage.id === "portal")).toMatchObject({
      status: "complete",
      detail: "Founder confirmed customer portal access",
    });
    expect(buildExceptionCodes(stages)).toEqual(["jobber"]);
  });

  it("marks only the next sequential step as actionable for a new lead", () => {
    const stages = buildJourneyStages({
      hasLead: true,
      hasPresentation: false,
      hasAgreement: false,
      paymentReady: false,
      portalUrl: null,
      welcomeDeliveryStatus: null,
      jobberLinked: false,
      visitScheduled: false,
    });

    expect(buildExceptionCodes(stages)).toEqual(["presentation"]);
    expect(stages.find((stage) => stage.id === "agreement")?.status).toBe(
      "waiting",
    );
  });
});

describe("Atlas Pulse founder actions", () => {
  it("offers one reversible email and portal confirmation", () => {
    const base = {
      membershipId: "9aa145b0-ea61-4fd0-a82a-f235de827e64",
      presentationId: null,
      homeownerId: "56f02273-fb07-4d50-b948-d44242fbecad",
      portalUrl: "/portal/token",
      paymentReady: true,
      hasAgreement: true,
      jobberLinked: true,
      jobberWebUri: null,
      visitScheduled: true,
    };

    expect(
      buildJourneyActions({
        ...base,
        manualEmailComplete: false,
        manualPortalComplete: false,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "set_manual_completion",
          completed: true,
          label: "Mark email + portal complete",
        }),
      ]),
    );
    expect(
      buildJourneyActions({
        ...base,
        manualEmailComplete: true,
        manualPortalComplete: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "set_manual_completion",
          completed: false,
          label: "Undo founder confirmation",
        }),
      ]),
    );
  });
});

describe("Atlas Pulse matchmaker", () => {
  it("marks matching email and phone as high confidence", () => {
    const result = scoreCustomerMatch(
      {
        name: "Sylvia Moss",
        email: "SYLVIA@example.com",
        phone: "(559) 555-0112",
      },
      {
        name: "Sylvia Moss",
        email: "sylvia@example.com",
        phone: "559-555-0112",
      },
    );

    expect(result?.confidence).toBe("high");
    expect(result?.reasons).toEqual(
      expect.arrayContaining(["same email", "same phone", "same name"]),
    );
  });

  it("does not suggest a weak name-only resemblance", () => {
    expect(
      scoreCustomerMatch(
        { name: "John Smith", email: "john@one.example" },
        { name: "John Stone", email: "john@two.example" },
      ),
    ).toBeNull();
  });
});

describe("Atlas Pulse care forecast", () => {
  it("uses the fixed interior and screen add-on standards", () => {
    const opportunities = buildCareOpportunities({ month: 4 });
    expect(opportunities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "interior_cleaning", amount: 100 }),
        expect.objectContaining({ id: "screen_cleaning", amount: 50 }),
      ]),
    );
  });

  it("does not repeat a recently completed service", () => {
    const opportunities = buildCareOpportunities({
      month: 10,
      recentServiceNames: ["Interior window cleaning", "Gutter cleaning"],
    });
    expect(opportunities.some((item) => item.id === "interior_cleaning")).toBe(
      false,
    );
    expect(opportunities.some((item) => item.id === "gutter_care")).toBe(false);
  });
});
