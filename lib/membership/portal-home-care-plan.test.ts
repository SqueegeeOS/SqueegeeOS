import { describe, expect, it } from "vitest";
import { buildPortalCareRecordView } from "@/lib/membership/portal-view-model";
import {
  buildPortalHomeCarePlanFromPresentation,
  portalPlanFromPresentationRecord,
} from "@/lib/membership/portal-home-care-plan";
import { createDefaultPresentation } from "@/lib/presentations/repository";
import { slugifyPresentation } from "@/lib/presentations/calculations";

describe("presentation sign onboarding creates portal-loadable data", () => {
  it("persists an honest portal plan with no fabricated visits or savings", () => {
    const presentation = createDefaultPresentation({
      clientName: "Larry Buckley",
      tier: "quarterly",
      homeSqft: 3200,
    });
    presentation.clientAddress = "4125 Canyon Oaks Drive, Chico, CA 95928";

    const homeownerSlug = slugifyPresentation(presentation.clientName) ?? "larry-buckley";
    const propertySlug =
      slugifyPresentation(presentation.clientAddress) ?? "canyon-oaks";

    const plan = buildPortalHomeCarePlanFromPresentation({
      presentation,
      homeownerSlug,
      propertySlug,
      planName: "Quarterly Care",
      agreementTier: "quarterly",
      visitPrice: 285,
    });

    expect(plan.property.lastVisit).toBe("");
    expect(plan.findings).toEqual([]);
    expect(plan.property.heroImage).toBe("");
    expect(plan.propertyProfile.some((row) => row.label === "Last Visit")).toBe(
      false,
    );

    const loaded = portalPlanFromPresentationRecord(plan);
    expect(loaded.homeowner.slug).toBe(homeownerSlug);
    expect(loaded.property.slug).toBe(propertySlug);
    expect(loaded.property.address).toContain("Canyon Oaks");

    const view = buildPortalCareRecordView(loaded, null);
    expect(view.landingHeadline).toBe(
      "Larry, Larry Buckley is under care.",
    );
    expect(view.timelineEntries).toHaveLength(0);
    expect(view.showSavings).toBe(false);
    expect(view.visitPriceLabel).toContain("per visit");
  });
});
