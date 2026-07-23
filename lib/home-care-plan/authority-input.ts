import { serviceOptions, type ServiceOption } from "@/lib/acquisition/types";
import type {
  HomeCarePlanDraft,
  HomeCarePlanFindingDraft,
} from "@/lib/home-care-plan/create-types";

const SERVICE_OPTIONS = new Set<string>(serviceOptions);
const MAX_FINDINGS = 24;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function text(value: unknown, maximumLength: number): string | null {
  return typeof value === "string" && value.length <= maximumLength
    ? value
    : null;
}

function parseFinding(value: unknown): HomeCarePlanFindingDraft | null {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ["description", "id", "image", "severity", "title"])
  ) {
    return null;
  }
  const id = text(value.id, 96);
  const title = text(value.title, 160);
  const severity = text(value.severity, 64);
  const description = text(value.description, 2_000);
  const image = text(value.image, 2_048);
  return id !== null && title !== null && severity !== null &&
      description !== null && image !== null
    ? { id, title, severity, description, image }
    : null;
}

export function parseHomeCarePlanDraft(value: unknown): HomeCarePlanDraft | null {
  if (
    !isObject(value) ||
    !hasExactKeys(value, [
      "careFrequency",
      "findings",
      "homeowner",
      "includeInteriorGlass",
      "internalNotes",
      "membershipEstatePrice",
      "membershipOneTimePrice",
      "membershipPreferredPrice",
      "personalNoteBody",
      "personalNoteGreeting",
      "personalNoteSignoff",
      "property",
      "propertyHealthNarrative",
      "propertyHealthRating",
      "recommendationBody",
      "recommendationClosing",
      "recommendationHeadline",
      "recommendedTier",
      "services",
      "standardPricingApplied",
      "standardPricingNote",
    ]) ||
    !isObject(value.homeowner) ||
    !hasExactKeys(value.homeowner, ["email", "fullName", "phone"]) ||
    !isObject(value.property) ||
    !hasExactKeys(value.property, [
      "address",
      "city",
      "heroImage",
      "homeCareScore",
      "lastVisit",
      "name",
      "propertyType",
      "squareFeet",
      "state",
      "yearBuilt",
      "zip",
    ]) ||
    !Array.isArray(value.services) ||
    !value.services.every(
      (service): service is ServiceOption =>
        typeof service === "string" && SERVICE_OPTIONS.has(service),
    ) ||
    !Array.isArray(value.findings) ||
    value.findings.length > MAX_FINDINGS
  ) {
    return null;
  }

  const findings = value.findings.map(parseFinding);
  if (findings.some((finding) => !finding)) return null;

  const homeowner = {
    fullName: text(value.homeowner.fullName, 160),
    email: text(value.homeowner.email, 320),
    phone: text(value.homeowner.phone, 40),
  };
  const property = {
    name: text(value.property.name, 160),
    address: text(value.property.address, 240),
    city: text(value.property.city, 120),
    state: text(value.property.state, 120),
    zip: text(value.property.zip, 20),
    yearBuilt: text(value.property.yearBuilt, 4),
    homeCareScore: text(value.property.homeCareScore, 3),
    lastVisit: text(value.property.lastVisit, 120),
    heroImage: text(value.property.heroImage, 2_048),
    propertyType: text(value.property.propertyType, 40),
    squareFeet: text(value.property.squareFeet, 8),
  };
  if (
    Object.values(homeowner).some((entry) => entry === null) ||
    Object.values(property).some((entry) => entry === null) ||
    !homeowner.fullName?.trim() ||
    !property.name?.trim() ||
    !property.address?.trim() ||
    (homeowner.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(homeowner.email)) ||
    (property.squareFeet && !/^\d{1,8}$/.test(property.squareFeet)) ||
    (property.yearBuilt && !/^\d{4}$/.test(property.yearBuilt)) ||
    (property.homeCareScore && !/^\d{1,3}$/.test(property.homeCareScore)) ||
    property.lastVisit === null ||
    property.lastVisit.trim() !== ""
  ) {
    return null;
  }

  const stringFields = {
    propertyHealthRating: text(value.propertyHealthRating, 80),
    propertyHealthNarrative: text(value.propertyHealthNarrative, 8_000),
    recommendationHeadline: text(value.recommendationHeadline, 300),
    recommendationBody: text(value.recommendationBody, 12_000),
    recommendationClosing: text(value.recommendationClosing, 2_000),
    personalNoteGreeting: text(value.personalNoteGreeting, 200),
    personalNoteBody: text(value.personalNoteBody, 8_000),
    personalNoteSignoff: text(value.personalNoteSignoff, 160),
    membershipOneTimePrice: text(value.membershipOneTimePrice, 16),
    membershipPreferredPrice: text(value.membershipPreferredPrice, 16),
    membershipEstatePrice: text(value.membershipEstatePrice, 16),
    standardPricingNote: text(value.standardPricingNote, 500),
    internalNotes: text(value.internalNotes, 8_000),
  };
  if (Object.values(stringFields).some((entry) => entry === null)) return null;

  const pricePattern = /^\d{1,7}(?:\.\d{1,2})?$/;
  if (
    !pricePattern.test(stringFields.membershipOneTimePrice!) ||
    !pricePattern.test(stringFields.membershipPreferredPrice!) ||
    !pricePattern.test(stringFields.membershipEstatePrice!) ||
    (value.recommendedTier !== "one-time" &&
      value.recommendedTier !== "preferred" &&
      value.recommendedTier !== "estate") ||
    (value.careFrequency !== "quarterly" &&
      value.careFrequency !== "bi_annual") ||
    typeof value.includeInteriorGlass !== "boolean" ||
    typeof value.standardPricingApplied !== "boolean"
  ) {
    return null;
  }

  return {
    homeowner: homeowner as HomeCarePlanDraft["homeowner"],
    property: property as HomeCarePlanDraft["property"],
    services: value.services,
    findings: findings as HomeCarePlanFindingDraft[],
    ...stringFields as Omit<
      typeof stringFields,
      never
    >,
    recommendedTier: value.recommendedTier,
    careFrequency: value.careFrequency,
    includeInteriorGlass: value.includeInteriorGlass,
    standardPricingApplied: value.standardPricingApplied,
  } as HomeCarePlanDraft;
}
