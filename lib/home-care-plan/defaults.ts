import { squeegeekingGoogleReviews } from "@/lib/reviews/mock-data";
import { foundersAsPlanTeam } from "@/lib/team/founders";
import type { HomeCarePlanData } from "./types";

export const defaultHomeCareBrand = {
  company: "Squeegeeking",
  tagline: "Premium Home Care.",
  footerLines: [
    "Crafted with pride in Chico, California.",
    "Built on trust.",
    "Maintained through consistency.",
  ],
} as const;

/** Real Squeegeeking founders — see lib/team/founders.ts */
export const defaultHomeCareTeam = foundersAsPlanTeam();

export const defaultMembershipBenefits = [
  {
    title: "VIP Priority Scheduling",
    description: "Your home moves to the front of the calendar — every season.",
  },
  {
    title: "Member Pricing",
    description: "Preferred rates that reward the relationship, not just the visit.",
  },
  {
    title: "Property History",
    description: "Every chapter preserved in your living archive — never forgotten.",
  },
  {
    title: "Set It & Forget It",
    description: "We remember the seasons so you don't have to.",
  },
] as const;

export function buildCareJourney(propertyName: string) {
  return [
    {
      step: "Assessment",
      description: "We walk your property and document everything that matters.",
    },
    {
      step: "First Visit",
      description: `We arrive knowing ${propertyName} — not discovering it.`,
    },
    {
      step: "Property Timeline Begins",
      description: "Every visit, photo, and note preserved in your living archive.",
    },
    {
      step: "Quarterly Updates",
      description: "Seasonal care that matches how your home actually lives.",
    },
    {
      step: "Annual Home Review",
      description: "A year in review — the story of your property, documented.",
    },
  ];
}

export const defaultPlanReviews = squeegeekingGoogleReviews;

export const defaultHeroImage =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=85";

export const defaultFindingImage =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80";

export const SQUEEGEEKING_PHONE = "(530) 588-6235";

export function getPlanFounders(): HomeCarePlanData["team"] {
  return foundersAsPlanTeam();
}
