import type { Property } from "@/lib/property/types";
import type { HomeCarePlanDraft } from "./create-types";
import {
  buildCareJourney,
  defaultFindingImage,
  defaultHeroImage,
  defaultHomeCareBrand,
  defaultMembershipBenefits,
  defaultPlanReviews,
  getPlanFounders,
  SQUEEGEEKING_PHONE,
} from "./defaults";
import type { HomeCarePlanData, HomeCarePlanFinding } from "./types";
import { NOAH_PERSONAL_NOTE } from "@/lib/team/founders";
import {
  firstNameFromFullName,
  formatCurrencyInput,
  parseLines,
  toSlug,
} from "./utils";

function buildFindings(draft: HomeCarePlanDraft): HomeCarePlanFinding[] {
  return draft.findings.map((finding) => ({
    ...finding,
    image: finding.image || defaultFindingImage,
  }));
}

function tierName(id: HomeCarePlanDraft["recommendedTier"]): string {
  if (id === "one-time") return "One-Time Refresh";
  if (id === "estate") return "Estate Care";
  return "Preferred Care";
}

export function buildHomeCarePlanFromDraft(draft: HomeCarePlanDraft): HomeCarePlanData {
  const homeownerSlug = toSlug(draft.homeowner.fullName) || "homeowner";
  const propertySlug = toSlug(draft.property.name) || "property";
  const firstName = firstNameFromFullName(draft.homeowner.fullName);
  const propertyName = draft.property.name.trim() || "Your Property";
  const parsedScore = Number.parseInt(draft.property.homeCareScore, 10);
  const score = Number.isInteger(parsedScore) && parsedScore >= 0 && parsedScore <= 100
    ? parsedScore
    : null;
  const parsedYearBuilt = Number.parseInt(draft.property.yearBuilt, 10);
  const yearBuilt = Number.isInteger(parsedYearBuilt) && parsedYearBuilt >= 1000 &&
      parsedYearBuilt <= new Date().getFullYear() + 1
    ? parsedYearBuilt
    : null;
  // This authoring flow has no verified provider-visit provenance.
  const lastVisit = null;

  const recommendationParagraphs = parseLines(draft.recommendationBody);
  const personalParagraphs = parseLines(draft.personalNoteBody);

  const oneTimePrice = formatCurrencyInput(draft.membershipOneTimePrice) || "$680";
  const preferredPrice = formatCurrencyInput(draft.membershipPreferredPrice) || "$249";
  const estatePrice = formatCurrencyInput(draft.membershipEstatePrice) || "$449";

  const healthNarrative =
    draft.propertyHealthNarrative.trim() ||
    `${propertyName} has a care plan ready for review. Missing property history remains unknown until it is verified by a provider record.`;

  const recommendationHeadline =
    draft.recommendationHeadline.trim() ||
    `Why recurring care matters for ${propertyName}.`;

  const personalGreeting =
    draft.personalNoteGreeting.trim() || `${firstName || "Friend"},`;

  const defaultPersonalBody = [
    "Thank you for inviting us to your home.",
    "Our mission is simple. Help you enjoy your property while we remember everything for you.",
    "We look forward to caring for your home for many years.",
  ];

  return {
    homeowner: {
      firstName: firstName || "Homeowner",
      fullName: draft.homeowner.fullName.trim() || "Homeowner",
      slug: homeownerSlug,
    },
    property: {
      name: propertyName,
      slug: propertySlug,
      address: draft.property.address.trim() || "Address pending",
      city: draft.property.city.trim() || "Chico",
      state: draft.property.state.trim() || "California",
      heroImage: draft.property.heroImage.trim() || defaultHeroImage,
      yearBuilt,
      homeCareScore: score,
      lastVisit,
      membershipRecommendation: tierName(draft.recommendedTier),
    },
    brand: {
      company: defaultHomeCareBrand.company,
      tagline: defaultHomeCareBrand.tagline,
      craftedFor: `Crafted for ${draft.homeowner.fullName.trim() || "you"}`,
      footerLines: [...defaultHomeCareBrand.footerLines],
    },
    hero: {
      title: "Your Personalized Home Care Plan",
      subheadline: `Created exclusively for your ${propertyName}.`,
      intro:
        "We prepared a personalized maintenance strategy from the information currently available for your home.",
      cta: "Begin Your Home Care Plan",
    },
    propertyHealth: {
      rating: draft.propertyHealthRating,
      narrative: healthNarrative,
    },
    propertyProfile: [
      {
        label: "Property Type",
        value: draft.property.propertyType || "Residence",
        detail: `${draft.property.city || "Chico"} property`,
      },
      {
        label: "Services Included",
        value: draft.services.length > 0 ? `${draft.services.length} areas` : "Custom",
        detail: draft.services.join(", ") || "Tailored to your inspection",
      },
      ...(score === null
        ? []
        : [{
            label: "Home Care Score",
            value: String(score),
            detail: "Recorded in this authored plan",
          }]),
      ...(yearBuilt === null
        ? []
        : [{
            label: "Year Built",
            value: String(yearBuilt),
            detail: "Architectural context for care planning",
          }]),
    ],
    findings: buildFindings(draft),
    recommendation: {
      headline: recommendationHeadline,
      paragraphs:
        recommendationParagraphs.length > 0
          ? recommendationParagraphs
          : [
              "Your home doesn't age in a single moment. It ages in seasons — rain against west-facing glass, summer dust along terraces, debris that finds the gutters when no one is watching.",
              "One visit can restore what today demands. Recurring care ensures nothing becomes an emergency repair.",
            ],
      closing: draft.recommendationClosing,
    },
    personalNote: {
      greeting: personalGreeting,
      paragraphs:
        personalParagraphs.length > 0 ? personalParagraphs : defaultPersonalBody,
      signoff: draft.personalNoteSignoff.trim() || NOAH_PERSONAL_NOTE.signoff,
      title: NOAH_PERSONAL_NOTE.title,
      company: NOAH_PERSONAL_NOTE.company,
    },
    memberships: [
      {
        id: "one-time",
        name: "One-Time Refresh",
        price: oneTimePrice,
        period: "per visit",
        lifestyle: "Perfect for homeowners needing immediate service.",
        highlighted: draft.recommendedTier === "one-time",
      },
      {
        id: "preferred",
        name: "Preferred Care",
        price: preferredPrice,
        period: "per month",
        badge: draft.recommendedTier === "preferred" ? "Recommended" : undefined,
        lifestyle:
          "Designed for homeowners who value convenience and proactive maintenance.",
        highlighted: draft.recommendedTier === "preferred",
      },
      {
        id: "estate",
        name: "Estate Care",
        price: estatePrice,
        period: "per month",
        lifestyle:
          "Designed for homeowners who want complete year-round property stewardship.",
        highlighted: draft.recommendedTier === "estate",
      },
    ],
    careJourney: buildCareJourney(propertyName),
    membershipBenefits: [...defaultMembershipBenefits],
    team: getPlanFounders(),
    reviews: defaultPlanReviews,
    closing: {
      headline: `Begin stewarding ${propertyName} the way it deserves.`,
      subline: "Your plan is ready. We're honored to care for your home.",
      phone: SQUEEGEEKING_PHONE,
      location: "Chico, California",
      cta: "Become a Member",
    },
  };
}

export function draftFromProperty(
  property: Property,
  homeowner: { fullName: string; firstName: string; email: string },
): HomeCarePlanDraft {
  const firstName = homeowner.firstName;
  return {
    homeowner: {
      fullName: homeowner.fullName,
      email: homeowner.email,
      phone: "",
    },
    property: {
      name: property.name,
      address: property.address,
      city: property.city,
      state: property.state === "CA" ? "California" : property.state,
      zip: property.zip,
      yearBuilt: String(property.yearBuilt),
      homeCareScore: String(property.homeCareScore),
      lastVisit: property.lastVisit,
      heroImage: property.heroImage,
      propertyType: property.type,
      squareFeet: String(property.squareFeet || 2500),
    },
    services: [],
    findings: [],
    propertyHealthRating: property.healthStatus,
    propertyHealthNarrative: property.narrative,
    recommendationHeadline: `Why recurring care matters for ${property.name}.`,
    recommendationBody: "",
    recommendationClosing:
      "This is not pressure. It is the same philosophy you already apply to everything you value — consistent, thoughtful, ahead of the problem.",
    personalNoteGreeting: `${firstName},`,
    personalNoteBody: [
      "Thank you for inviting us to your home.",
      "Our mission is simple. Help you enjoy your property while we remember everything for you.",
      "We look forward to caring for your home for many years.",
    ].join("\n"),
    personalNoteSignoff: "Noah",
    membershipOneTimePrice: "680",
    membershipPreferredPrice: "249",
    membershipEstatePrice: "449",
    recommendedTier: "preferred",
    careFrequency: "quarterly",
    includeInteriorGlass: false,
    standardPricingApplied: false,
    standardPricingNote: "",
    internalNotes: "",
  };
}

export function getPlanPresentationPath(data: HomeCarePlanData): string {
  return `/homecare/${data.homeowner.slug}/${data.property.slug}/plan`;
}
