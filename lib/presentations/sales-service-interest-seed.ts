import {
  applyCarePlanServicePolicy,
  createDefaultCarePlan,
  type CarePlanServiceId,
  type PresentationCarePlan,
  type PresentationPlanMode,
} from "./care-plan";
import {
  normalizeSalesServiceInterests,
  salesServiceInterestLabel,
  type SalesServiceInterest,
} from "@/lib/sales/service-interests";
import type { PresentationTier } from "./types";

const CARE_PLAN_SERVICE_BY_INTEREST: Partial<
  Record<SalesServiceInterest, CarePlanServiceId>
> = {
  interior_windows: "interiorWindows",
  screens: "screens",
  cobweb_removal: "cobwebRemoval",
  solar_panels: "solarPanels",
  pressure_washing: "pressureWashing",
};

export interface SalesServiceInterestPresentationSeed {
  planMode: PresentationPlanMode;
  carePlan: PresentationCarePlan;
}
/**
 * Doorstep interest is not contractual scope. Selected add-ons therefore enter
 * a new presentation as optional, with $0 added until the owner deliberately
 * chooses the included visits and confirms the plan before signature.
 */
export function createSalesServiceInterestPresentationSeed(input: {
  tier: PresentationTier;
  serviceInterests?: SalesServiceInterest[];
}): SalesServiceInterestPresentationSeed {
  const interests = normalizeSalesServiceInterests(input.serviceInterests);
  const discussedExtras = interests.filter(
    (interest) => interest !== "exterior_windows",
  );
  const structuredExtras = interests.flatMap((interest) => {
    const serviceId = CARE_PLAN_SERVICE_BY_INTEREST[interest];
    return serviceId ? [{ interest, serviceId }] : [];
  });
  let carePlan = createDefaultCarePlan({ tier: input.tier });

  for (const { serviceId } of structuredExtras) {
    carePlan = applyCarePlanServicePolicy(
      carePlan,
      serviceId,
      "optional_add_on",
    );
  }

  if (discussedExtras.length === 0) {
    return { planMode: "simple", carePlan };
  }

  const labels = discussedExtras.map((interest) =>
    interest === "other"
      ? "another service"
      : salesServiceInterestLabel(interest).toLocaleLowerCase("en-US"),
  );
  carePlan = {
    ...carePlan,
    summary: `Exterior window care every visit. The customer also asked about ${labels.join(
      ", ",
    )}; those items stay optional until exact visits and pricing are confirmed below.`,
    customerChoiceNote:
      "Doorstep interests are a starting point. Included services and pricing are confirmed in this plan before signing.",
  };

  return { planMode: "custom", carePlan };
}
