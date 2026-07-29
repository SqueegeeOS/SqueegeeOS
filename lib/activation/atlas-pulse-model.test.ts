import { describe, expect, it } from "vitest";
import {
  buildCareOpportunities,
  buildExceptionCodes,
  buildJourneyStages,
  journeyCompletionPercent,
  scoreCustomerMatch,
} from "./atlas-pulse-model";

describe("Atlas Pulse journey", () => {
  it("shows a complete seven-step activation", () => {
    const stages = buildJourneyStages({
      hasLead: true,
      hasPresentation: true,
      hasAgreement: true,
      paymentReady: true,
      portalUrl: "https://www.squeegeeking.net/portal/token",
      welcomeDeliveryStatus: "delivered",
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
    expect(buildExceptionCodes(stages)).toEqual([
      "portal",
      "jobber",
    ]);
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
