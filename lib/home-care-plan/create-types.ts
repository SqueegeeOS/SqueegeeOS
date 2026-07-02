import type { ServiceOption } from "@/lib/acquisition/types";

export interface HomeCarePlanFindingDraft {
  id: string;
  title: string;
  severity: string;
  description: string;
  image: string;
}

export interface HomeCarePlanDraft {
  homeowner: {
    fullName: string;
    email: string;
    phone: string;
  };
  property: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    yearBuilt: string;
    homeCareScore: string;
    lastVisit: string;
    heroImage: string;
    propertyType: string;
  };
  services: ServiceOption[];
  findings: HomeCarePlanFindingDraft[];
  propertyHealthRating: string;
  propertyHealthNarrative: string;
  recommendationHeadline: string;
  recommendationBody: string;
  recommendationClosing: string;
  personalNoteGreeting: string;
  personalNoteBody: string;
  personalNoteSignoff: string;
  membershipOneTimePrice: string;
  membershipPreferredPrice: string;
  membershipEstatePrice: string;
  recommendedTier: "one-time" | "preferred" | "estate";
  internalNotes: string;
}

export const emptyHomeCarePlanDraft: HomeCarePlanDraft = {
  homeowner: {
    fullName: "",
    email: "",
    phone: "",
  },
  property: {
    name: "",
    address: "",
    city: "Chico",
    state: "California",
    zip: "",
    yearBuilt: "",
    homeCareScore: "",
    lastVisit: "",
    heroImage: "",
    propertyType: "Residence",
  },
  services: [],
  findings: [],
  propertyHealthRating: "Well Maintained",
  propertyHealthNarrative: "",
  recommendationHeadline: "",
  recommendationBody: "",
  recommendationClosing:
    "This is not pressure. It is the same philosophy you already apply to everything you value — consistent, thoughtful, ahead of the problem.",
  personalNoteGreeting: "",
  personalNoteBody: "",
  personalNoteSignoff: "Noah",
  membershipOneTimePrice: "680",
  membershipPreferredPrice: "249",
  membershipEstatePrice: "449",
  recommendedTier: "preferred",
  internalNotes: "",
};

export const homeCarePlanWizardSteps = [
  "Homeowner",
  "Property",
  "Services",
  "Notes",
  "Pricing",
  "Generate",
] as const;

export type HomeCarePlanWizardStep = (typeof homeCarePlanWizardSteps)[number];
