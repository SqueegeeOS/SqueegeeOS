import type { ServiceOption } from "@/lib/acquisition/types";
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

const serviceFindingTemplates: Record<
  ServiceOption,
  { title: string; severity: string; description: string }
> = {
  "Window Cleaning": {
    title: "Window Clarity",
    severity: "Attention",
    description:
      "Exterior glass shows seasonal buildup and hard water spotting. A preservation-focused clean restores clarity without compromising seals or finishes.",
  },
  "Gutter Cleaning": {
    title: "Gutter Flow",
    severity: "Routine",
    description:
      "Debris accumulation along rooflines. Clearing now protects fascia, soffits, and foundation drainage before seasonal rains.",
  },
  "Pressure Washing": {
    title: "Surface Buildup",
    severity: "Attention",
    description:
      "Walkways, patios, and siding show organic growth and canyon dust. Gentle pressure washing preserves surfaces while restoring curb presence.",
  },
  "Solar Panel Cleaning": {
    title: "Solar Efficiency",
    severity: "Monitor",
    description:
      "Panel surfaces show pollen and dust film. Cleaning restores efficiency and protects long-term panel performance.",
  },
  "Exterior Home Care": {
    title: "Exterior Stewardship",
    severity: "Seasonal",
    description:
      "A coordinated exterior refresh — glass, surfaces, and details — keeps the home presentation consistent through every season.",
  },
  "Full Home Care Membership": {
    title: "Ongoing Stewardship",
    severity: "Recommended",
    description:
      "Your property benefits from recurring care — priority scheduling, documented history, and proactive maintenance before issues compound.",
  },
};

function findingFromService(service: ServiceOption, index: number): HomeCarePlanFinding {
  const template = serviceFindingTemplates[service];
  return {
    id: `finding-${toSlug(service)}-${index}`,
    title: template.title,
    severity: template.severity,
    description: template.description,
    image: defaultFindingImage,
  };
}

function buildFindings(draft: HomeCarePlanDraft): HomeCarePlanFinding[] {
  if (draft.findings.length > 0) {
    return draft.findings.map((finding) => ({
      ...finding,
      image: finding.image || defaultFindingImage,
    }));
  }

  return draft.services.map((service, index) => findingFromService(service, index));
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
  const score = Number.parseInt(draft.property.homeCareScore, 10) || 85;
  const yearBuilt = Number.parseInt(draft.property.yearBuilt, 10) || new Date().getFullYear();
  const lastVisit =
    draft.property.lastVisit.trim() ||
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const recommendationParagraphs = parseLines(draft.recommendationBody);
  const personalParagraphs = parseLines(draft.personalNoteBody);

  const oneTimePrice = formatCurrencyInput(draft.membershipOneTimePrice) || "$680";
  const preferredPrice = formatCurrencyInput(draft.membershipPreferredPrice) || "$249";
  const estatePrice = formatCurrencyInput(draft.membershipEstatePrice) || "$449";

  const healthNarrative =
    draft.propertyHealthNarrative.trim() ||
    `${propertyName} is in ${draft.propertyHealthRating.toLowerCase()} condition. Your score of ${score} reflects thoughtful stewardship. What remains is rhythm — the kind of seasonal attention that keeps a home ahead of deterioration rather than chasing it.`;

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
        "We inspected your property and created a personalized maintenance strategy designed specifically for your home.",
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
        label: "Maintenance Profile",
        value: score >= 90 ? "Proactive" : "Developing",
        detail: "Ahead of deterioration, never behind it",
      },
      {
        label: "Services Included",
        value: draft.services.length > 0 ? `${draft.services.length} areas` : "Custom",
        detail: draft.services.join(", ") || "Tailored to your inspection",
      },
      {
        label: "Home Care Score",
        value: String(score),
        detail: "Based on your recent property assessment",
      },
      {
        label: "Year Built",
        value: String(yearBuilt),
        detail: "Architectural context for care planning",
      },
      {
        label: "Last Visit",
        value: lastVisit,
        detail: "Most recent documented care",
      },
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
    internalNotes: "",
  };
}

export function getPlanPresentationPath(data: HomeCarePlanData): string {
  return `/homecare/${data.homeowner.slug}/${data.property.slug}/plan`;
}
