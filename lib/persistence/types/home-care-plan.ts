import type { HomeCarePlanDraft } from "@/lib/home-care-plan/create-types";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";

export type HomeCarePlanStatus =
  | "draft"
  | "generated"
  | "published"
  | "archived";

export type PersistenceBackend = "session" | "supabase";

/**
 * Persisted Home Care Plan — maps to `home_care_plans` table in Supabase.
 * `presentation` stores the full customer-facing JSON document.
 */
export interface PersistedHomeCarePlan {
  id: string;
  homeownerId: string | null;
  propertyId: string | null;
  homeownerSlug: string;
  propertySlug: string;
  status: HomeCarePlanStatus;
  presentation: HomeCarePlanData;
  draft: HomeCarePlanDraft | null;
  generatedAt: string;
  updatedAt: string;
  storageBackend: PersistenceBackend;
}

export type PersistedHomeCarePlanInput = Omit<
  PersistedHomeCarePlan,
  "id" | "generatedAt" | "updatedAt"
> & {
  id?: string;
  generatedAt?: string;
  updatedAt?: string;
};

/** Envelope written to sessionStorage — backward-compatible with legacy raw JSON */
export interface HomeCarePlanStorageEnvelope {
  version: 2;
  record: PersistedHomeCarePlan;
}

export const HOME_CARE_PLAN_STORAGE_VERSION = 2 as const;
