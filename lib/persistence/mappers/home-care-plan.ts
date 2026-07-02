import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import type { HomeCarePlanDraft } from "@/lib/home-care-plan/create-types";
import { firstNameFromFullName, toSlug } from "@/lib/home-care-plan/utils";
import type {
  HomeCarePlanStorageEnvelope,
  PersistedHomeCarePlan,
  PersistedHomeCarePlanInput,
} from "../types";
import { HOME_CARE_PLAN_STORAGE_VERSION } from "../types";

export function createHomeCarePlanRecord(
  presentation: HomeCarePlanData,
  draft: HomeCarePlanDraft | null = null,
): PersistedHomeCarePlanInput {
  const now = new Date().toISOString();

  return {
    homeownerId: null,
    propertyId: null,
    homeownerSlug: presentation.homeowner.slug,
    propertySlug: presentation.property.slug,
    status: "generated",
    presentation,
    draft,
    storageBackend: "session",
    generatedAt: now,
    updatedAt: now,
  };
}

export function finalizeHomeCarePlanRecord(
  input: PersistedHomeCarePlanInput,
  id?: string,
): PersistedHomeCarePlan {
  const now = new Date().toISOString();

  return {
    id: id ?? `hcp_${input.homeownerSlug}_${input.propertySlug}`,
    homeownerId: input.homeownerId,
    propertyId: input.propertyId,
    homeownerSlug: input.homeownerSlug,
    propertySlug: input.propertySlug,
    status: input.status,
    presentation: input.presentation,
    draft: input.draft,
    generatedAt: input.generatedAt ?? now,
    updatedAt: input.updatedAt ?? now,
    storageBackend: input.storageBackend,
  };
}

export function presentationFromRecord(
  record: PersistedHomeCarePlan,
): HomeCarePlanData {
  return record.presentation;
}

export function wrapForStorage(record: PersistedHomeCarePlan): HomeCarePlanStorageEnvelope {
  return {
    version: HOME_CARE_PLAN_STORAGE_VERSION,
    record,
  };
}

/** Parse sessionStorage value — supports v2 envelope and legacy raw HomeCarePlanData */
export function parseStoredHomeCarePlan(raw: string): PersistedHomeCarePlan | null {
  try {
    const parsed = JSON.parse(raw) as
      | HomeCarePlanStorageEnvelope
      | HomeCarePlanData
      | { presentation?: HomeCarePlanData };

    if (
      parsed &&
      typeof parsed === "object" &&
      "version" in parsed &&
      parsed.version === HOME_CARE_PLAN_STORAGE_VERSION &&
      "record" in parsed &&
      parsed.record?.presentation
    ) {
      return parsed.record;
    }

    const legacyPresentation =
      "presentation" in parsed && parsed.presentation
        ? parsed.presentation
        : (parsed as HomeCarePlanData);

    if (
      legacyPresentation?.homeowner?.slug &&
      legacyPresentation?.property?.slug
    ) {
      return finalizeHomeCarePlanRecord(
        createHomeCarePlanRecord(legacyPresentation),
      );
    }

    return null;
  } catch {
    return null;
  }
}

export function homeownerInputFromPresentation(
  presentation: HomeCarePlanData,
  contact?: { email?: string; phone?: string },
) {
  return {
    slug: presentation.homeowner.slug,
    fullName: presentation.homeowner.fullName,
    firstName: presentation.homeowner.firstName,
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
  };
}

export function propertyInputFromPresentation(
  presentation: HomeCarePlanData,
  homeownerId: string,
  extras?: { zip?: string; type?: string },
) {
  return {
    homeownerId,
    slug: presentation.property.slug,
    name: presentation.property.name,
    address: presentation.property.address,
    city: presentation.property.city,
    state: presentation.property.state,
    zip: extras?.zip ?? "",
    type: (extras?.type as "Residence") ?? "Residence",
    heroImage: presentation.property.heroImage,
    homeCareScore: presentation.property.homeCareScore,
    healthStatus: null,
    yearBuilt: presentation.property.yearBuilt,
    squareFeet: null,
    narrative: presentation.propertyHealth?.narrative ?? null,
    lastVisit: presentation.property.lastVisit,
  };
}

export function slugsFromDraft(draft: HomeCarePlanDraft) {
  return {
    homeownerSlug: toSlug(draft.homeowner.fullName) || "homeowner",
    propertySlug: toSlug(draft.property.name) || "property",
    firstName: firstNameFromFullName(draft.homeowner.fullName),
  };
}
