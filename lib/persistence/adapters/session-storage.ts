import type { MembershipAgreementRecord } from "@/lib/membership/types";
import type {
  PersistedHomeCarePlan,
  PersistedHomeCarePlanInput,
  PersistedHomeowner,
  PersistedHomeownerInput,
  PersistedMembership,
  PersistedMembershipInput,
  PersistedPhotoDocument,
  PersistedPhotoDocumentInput,
  PersistedProperty,
  PersistedPropertyInput,
  PersistedSignedAgreement,
  PersistedSignedAgreementInput,
} from "../types";
import type { PersistenceAdapter } from "./types";
import {
  finalizeHomeCarePlanRecord,
  parseStoredHomeCarePlan,
  wrapForStorage,
} from "../mappers/home-care-plan";

const PLAN_PREFIX = "squeegeeos:hcp:";
const HOMEOWNER_PREFIX = "squeegeeos:homeowner:";
const PROPERTY_PREFIX = "squeegeeos:property:";
const MEMBERSHIP_PREFIX = "squeegeeos:membership:";
const AGREEMENT_PREFIX = "squeegeeos:agreement:";
const ASSET_PREFIX = "squeegeeos:asset:";
const PLAN_INDEX_KEY = "squeegeeos:hcp:index";

function planKey(homeownerSlug: string, propertySlug: string): string {
  return `${PLAN_PREFIX}${homeownerSlug}:${propertySlug}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readIndex(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(sessionStorage.getItem(PLAN_INDEX_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeIndex(keys: string[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PLAN_INDEX_KEY, JSON.stringify(keys));
}

function addToPlanIndex(key: string): void {
  const index = readIndex();
  if (!index.includes(key)) {
    writeIndex([...index, key]);
  }
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(value));
}

function finalizeHomeowner(input: PersistedHomeownerInput): PersistedHomeowner {
  const now = nowIso();
  return {
    id: input.id ?? createId("ho"),
    slug: input.slug,
    fullName: input.fullName,
    firstName: input.firstName,
    email: input.email,
    phone: input.phone,
    createdAt: now,
    updatedAt: now,
  };
}

function finalizeProperty(input: PersistedPropertyInput): PersistedProperty {
  const now = nowIso();
  return {
    id: input.id ?? createId("prop"),
    homeownerId: input.homeownerId,
    slug: input.slug,
    name: input.name,
    address: input.address,
    city: input.city,
    state: input.state,
    zip: input.zip,
    type: input.type,
    heroImage: input.heroImage,
    homeCareScore: input.homeCareScore,
    healthStatus: input.healthStatus,
    yearBuilt: input.yearBuilt,
    squareFeet: input.squareFeet,
    narrative: input.narrative,
    lastVisit: input.lastVisit,
    createdAt: now,
    updatedAt: now,
  };
}

export const sessionStorageAdapter: PersistenceAdapter = {
  backend: "session",
  isCloudConnected: false,

  async saveHomeCarePlan(
    input: PersistedHomeCarePlanInput,
  ): Promise<PersistedHomeCarePlan> {
    const record = finalizeHomeCarePlanRecord(
      { ...input, storageBackend: "session" },
      input.id,
    );
    const key = planKey(record.homeownerSlug, record.propertySlug);

    if (typeof window !== "undefined") {
      writeJson(key, wrapForStorage(record));
      sessionStorage.setItem(`${key}:savedAt`, record.updatedAt);
      addToPlanIndex(key);
    }

    return record;
  },

  async getHomeCarePlanBySlugs(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedHomeCarePlan | null> {
    if (typeof window === "undefined") return null;

    const key = planKey(homeownerSlug, propertySlug);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    return parseStoredHomeCarePlan(raw);
  },

  async listHomeCarePlans(): Promise<PersistedHomeCarePlan[]> {
    if (typeof window === "undefined") return [];

    const plans: PersistedHomeCarePlan[] = [];
    for (const key of readIndex()) {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const record = parseStoredHomeCarePlan(raw);
      if (record) plans.push(record);
    }
    return plans;
  },

  async deleteHomeCarePlan(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<void> {
    if (typeof window === "undefined") return;

    const key = planKey(homeownerSlug, propertySlug);
    sessionStorage.removeItem(key);
    sessionStorage.removeItem(`${key}:savedAt`);
    writeIndex(readIndex().filter((entry) => entry !== key));
  },

  async upsertHomeowner(
    input: PersistedHomeownerInput,
  ): Promise<PersistedHomeowner> {
    const existing = await sessionStorageAdapter.getHomeownerBySlug(input.slug);
    const record = finalizeHomeowner({
      ...input,
      id: existing?.id ?? input.id,
    });
    writeJson(`${HOMEOWNER_PREFIX}${record.slug}`, record);
    return record;
  },

  async getHomeownerBySlug(slug: string): Promise<PersistedHomeowner | null> {
    return readJson<PersistedHomeowner>(`${HOMEOWNER_PREFIX}${slug}`);
  },

  async upsertProperty(
    input: PersistedPropertyInput,
  ): Promise<PersistedProperty> {
    const key = `${PROPERTY_PREFIX}${input.homeownerId}:${input.slug}`;
    const existing = readJson<PersistedProperty>(key);
    const record = finalizeProperty({
      ...input,
      id: existing?.id ?? input.id,
    });
    writeJson(key, record);
    return record;
  },

  async getPropertyBySlug(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedProperty | null> {
    const homeowner = await sessionStorageAdapter.getHomeownerBySlug(
      homeownerSlug,
    );
    if (!homeowner) return null;
    return readJson<PersistedProperty>(
      `${PROPERTY_PREFIX}${homeowner.id}:${propertySlug}`,
    );
  },

  async saveMembership(
    input: PersistedMembershipInput,
  ): Promise<PersistedMembership> {
    const now = nowIso();
    const record: PersistedMembership = {
      id: input.id ?? createId("mem"),
      presentationId: input.presentationId ?? null,
      agreementId: input.agreementId ?? null,
      salesTier: input.salesTier ?? null,
      visitPrice: input.visitPrice ?? null,
      annualRate: input.annualRate ?? null,
      visitsPerYear: input.visitsPerYear ?? null,
      billingSchedule: input.billingSchedule ?? "first_of_service_month",
      nextBillingDate: input.nextBillingDate ?? null,
      paymentSetupCompletedAt: input.paymentSetupCompletedAt ?? null,
      stripePaymentMethodId: input.stripePaymentMethodId ?? null,
      homeownerId: input.homeownerId,
      propertyId: input.propertyId,
      homeCarePlanId: input.homeCarePlanId,
      planId: input.planId,
      planName: input.planName,
      priceDisplay: input.priceDisplay,
      billingPeriod: input.billingPeriod,
      status: input.status,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripePriceId: input.stripePriceId,
      startedAt: input.startedAt,
      cancelledAt: input.cancelledAt,
      createdAt: now,
      updatedAt: now,
    };
    writeJson(
      `${MEMBERSHIP_PREFIX}${input.homeownerId}:${input.propertyId}`,
      record,
    );
    return record;
  },

  async getMembershipByProperty(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedMembership | null> {
    const property = await sessionStorageAdapter.getPropertyBySlug(
      homeownerSlug,
      propertySlug,
    );
    if (!property) return null;
    return readJson<PersistedMembership>(
      `${MEMBERSHIP_PREFIX}${property.homeownerId}:${property.id}`,
    );
  },

  async saveSignedAgreement(
    input: PersistedSignedAgreementInput,
  ): Promise<PersistedSignedAgreement> {
    const now = nowIso();
    const record: PersistedSignedAgreement = {
      id: input.id ?? createId("agr"),
      homeownerId: input.homeownerId,
      propertyId: input.propertyId,
      membershipId: input.membershipId,
      presentationId: input.presentationId ?? null,
      homeownerSlug: input.homeownerSlug,
      propertySlug: input.propertySlug,
      homeownerName: input.homeownerName,
      planId: input.planId,
      planName: input.planName,
      signature: input.signature,
      metadata: input.metadata,
      agreementPdfUrl: input.agreementPdfUrl,
      signatureImageStoragePath: input.signatureImageStoragePath,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      storageBackend: "session",
    };
    const listKey = `${AGREEMENT_PREFIX}${input.homeownerSlug}:${input.propertySlug}`;
    const existing = readJson<PersistedSignedAgreement[]>(listKey) ?? [];
    writeJson(listKey, [...existing, record]);
    return record;
  },

  async listSignedAgreementsByProperty(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedSignedAgreement[]> {
    return (
      readJson<PersistedSignedAgreement[]>(
        `${AGREEMENT_PREFIX}${homeownerSlug}:${propertySlug}`,
      ) ?? []
    );
  },

  async savePhotoDocument(
    input: PersistedPhotoDocumentInput,
  ): Promise<PersistedPhotoDocument> {
    const now = nowIso();
    const record: PersistedPhotoDocument = {
      id: input.id ?? createId("asset"),
      propertyId: input.propertyId,
      homeownerId: input.homeownerId,
      kind: input.kind,
      category: input.category,
      title: input.title,
      description: input.description,
      storagePath: input.storagePath,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      visitId: input.visitId,
      signedAgreementId: input.signedAgreementId,
      photoSource: input.photoSource ?? null,
      isPrimary: input.isPrimary ?? false,
      externalUrl: input.externalUrl ?? null,
      capturedAt: input.capturedAt,
      createdAt: now,
      updatedAt: now,
    };
    const listKey = `${ASSET_PREFIX}${input.propertyId}`;
    const existing = readJson<PersistedPhotoDocument[]>(listKey) ?? [];
    writeJson(listKey, [...existing, record]);
    return record;
  },

  async listPhotoDocumentsByProperty(
    propertyId: string,
  ): Promise<PersistedPhotoDocument[]> {
    return readJson<PersistedPhotoDocument[]>(`${ASSET_PREFIX}${propertyId}`) ?? [];
  },
};

export function membershipAgreementToSignedAgreement(
  agreement: MembershipAgreementRecord,
): PersistedSignedAgreementInput {
  return {
    homeownerId: null,
    propertyId: null,
    membershipId: null,
    presentationId: null,
    homeownerSlug: agreement.homeownerSlug,
    propertySlug: agreement.propertySlug,
    homeownerName: agreement.homeownerName,
    planId: agreement.planId,
    planName: agreement.planName,
    signature: agreement.signature,
    metadata: agreement.metadata,
    agreementPdfUrl: agreement.agreementPdfUrl,
    signatureImageStoragePath: agreement.signature.signatureImageUrl,
    status: agreement.status,
    storageBackend: "session",
  };
}
