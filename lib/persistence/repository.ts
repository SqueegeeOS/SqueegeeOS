import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import type { HomeCarePlanDraft } from "@/lib/home-care-plan/create-types";
import type { MembershipAgreementRecord } from "@/lib/membership/types";
import {
  getActivePersistenceBackend,
  isCloudPersistenceConnected,
} from "./config";
import {
  sessionStorageAdapter,
  membershipAgreementToSignedAgreement,
} from "./adapters/session-storage";
import { supabaseAdapter } from "./adapters/supabase";
import type { PersistenceAdapter } from "./adapters/types";
import {
  createHomeCarePlanRecord,
  homeownerInputFromPresentation,
  presentationFromRecord,
  propertyInputFromPresentation,
} from "./mappers/home-care-plan";
import type { PersistedHomeCarePlan } from "./types";

let adapterOverride: PersistenceAdapter | null = null;

export function getPersistenceAdapter(): PersistenceAdapter {
  if (adapterOverride) return adapterOverride;

  if (isCloudPersistenceConnected()) {
    return supabaseAdapter;
  }

  return sessionStorageAdapter;
}

/** Test hook — inject a custom adapter */
export function setPersistenceAdapterForTests(adapter: PersistenceAdapter | null) {
  adapterOverride = adapter;
}

export function getPersistenceStatus() {
  const adapter = getPersistenceAdapter();
  return {
    backend: getActivePersistenceBackend(),
    isCloudConnected: isCloudPersistenceConnected(),
    adapter: adapter.backend,
  };
}

export async function saveGeneratedHomeCarePlan(
  presentation: HomeCarePlanData,
  draft?: HomeCarePlanDraft | null,
): Promise<PersistedHomeCarePlan> {
  const adapter = getPersistenceAdapter();
  const input = createHomeCarePlanRecord(presentation, draft ?? null);
  input.storageBackend = adapter.backend;

  const homeowner = await adapter.upsertHomeowner(
    homeownerInputFromPresentation(presentation, {
      email: draft?.homeowner.email,
      phone: draft?.homeowner.phone,
    }),
  );

  const property = await adapter.upsertProperty(
    propertyInputFromPresentation(presentation, homeowner.id, {
      zip: draft?.property.zip,
      type: draft?.property.propertyType,
    }),
  );

  input.homeownerId = homeowner.id;
  input.propertyId = property.id;

  const record = await adapter.saveHomeCarePlan(input);

  // Mirror to sessionStorage so legacy local plans remain readable in this browser
  if (isCloudPersistenceConnected()) {
    await sessionStorageAdapter.saveHomeCarePlan({
      ...input,
      storageBackend: "session",
    });
  }

  return record;
}

export async function loadGeneratedHomeCarePlan(
  homeownerSlug: string,
  propertySlug: string,
): Promise<HomeCarePlanData | null> {
  const adapter = getPersistenceAdapter();
  let record = await adapter.getHomeCarePlanBySlugs(homeownerSlug, propertySlug);

  // Fallback: plans generated before cloud was connected
  if (!record && isCloudPersistenceConnected()) {
    record = await sessionStorageAdapter.getHomeCarePlanBySlugs(
      homeownerSlug,
      propertySlug,
    );
  }

  return record ? presentationFromRecord(record) : null;
}

export async function clearGeneratedHomeCarePlan(
  homeownerSlug: string,
  propertySlug: string,
): Promise<void> {
  const adapter = getPersistenceAdapter();
  await adapter.deleteHomeCarePlan(homeownerSlug, propertySlug);

  if (isCloudPersistenceConnected()) {
    await sessionStorageAdapter.deleteHomeCarePlan(homeownerSlug, propertySlug);
  }
}

export async function listGeneratedHomeCarePlans(): Promise<PersistedHomeCarePlan[]> {
  return getPersistenceAdapter().listHomeCarePlans();
}

export async function persistSignedAgreement(
  agreement: MembershipAgreementRecord,
): Promise<void> {
  const adapter = getPersistenceAdapter();
  await adapter.saveSignedAgreement(
    membershipAgreementToSignedAgreement(agreement),
  );
}
