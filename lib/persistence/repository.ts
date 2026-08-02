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
import type {
  PersistedHomeCarePlan,
  PersistedHomeCarePlanInput,
  PersistenceBackend,
} from "./types";

let adapterOverride: PersistenceAdapter | null = null;

const CLOUD_SAVE_TIMEOUT_MS = 15_000;

export interface SaveHomeCarePlanResult {
  record: PersistedHomeCarePlan;
  storageBackend: PersistenceBackend;
  usedCloudFallback: boolean;
  cloudError?: string;
}

export function getPersistenceAdapter(): PersistenceAdapter {
  if (adapterOverride) return adapterOverride;

  if (isCloudPersistenceConnected() && typeof window === "undefined") {
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

function formatCloudPersistenceError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Cloud save failed unexpectedly.";

  if (/invalid api key/i.test(message)) {
    return "Supabase API key is invalid. Check NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel.";
  }

  if (/row-level security|rls/i.test(message)) {
    return "Supabase blocked the save (RLS). Run schema.sql policies or tighten auth.";
  }

  if (/does not exist|pgrst205/i.test(message)) {
    return "Supabase tables are missing. Run lib/persistence/supabase/schema.sql.";
  }

  if (/timed out/i.test(message)) {
    return "Cloud save timed out. Check Supabase URL and network connectivity.";
  }

  return message;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function callHomeCarePlanApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api/admin/home-care-plans${path}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  const body = (await response.json().catch(() => null)) as
    | ({ error?: string } & T)
    | null;

  if (!response.ok || !body) {
    throw new Error(body?.error || "Authenticated cloud persistence failed");
  }

  return body;
}

async function persistWithAdapter(
  adapter: PersistenceAdapter,
  presentation: HomeCarePlanData,
  draft?: HomeCarePlanDraft | null,
): Promise<PersistedHomeCarePlan> {
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

  return adapter.saveHomeCarePlan(input);
}

async function mirrorPlanToSessionStorage(
  presentation: HomeCarePlanData,
  draft: HomeCarePlanDraft | null | undefined,
  record: PersistedHomeCarePlan,
): Promise<void> {
  const input: PersistedHomeCarePlanInput = {
    ...createHomeCarePlanRecord(presentation, draft ?? null),
    id: record.id,
    homeownerId: record.homeownerId,
    propertyId: record.propertyId,
    storageBackend: "session",
    generatedAt: record.generatedAt,
    updatedAt: record.updatedAt,
  };

  await sessionStorageAdapter.saveHomeCarePlan(input);
}

export async function saveGeneratedHomeCarePlan(
  presentation: HomeCarePlanData,
  draft?: HomeCarePlanDraft | null,
): Promise<SaveHomeCarePlanResult> {
  if (isCloudPersistenceConnected()) {
    try {
      const record = await withTimeout(
        typeof window === "undefined"
          ? persistWithAdapter(supabaseAdapter, presentation, draft)
          : callHomeCarePlanApi<{ record: PersistedHomeCarePlan }>("", {
              method: "POST",
              body: JSON.stringify({ presentation, draft: draft ?? null }),
            }).then((result) => result.record),
        CLOUD_SAVE_TIMEOUT_MS,
        "Cloud save",
      );

      if (typeof window !== "undefined") {
        try {
          await mirrorPlanToSessionStorage(presentation, draft, record);
        } catch (mirrorError) {
          console.warn(
            "[persistence] Cloud save succeeded but browser mirror failed:",
            mirrorError,
          );
        }
      }

      return {
        record,
        storageBackend: "supabase",
        usedCloudFallback: false,
      };
    } catch (error) {
      if (typeof window === "undefined") {
        throw error;
      }

      const cloudError = formatCloudPersistenceError(error);
      console.error(
        "[persistence] Supabase save failed — falling back to sessionStorage:",
        error,
      );

      const record = await persistWithAdapter(
        sessionStorageAdapter,
        presentation,
        draft,
      );

      return {
        record,
        storageBackend: "session",
        usedCloudFallback: true,
        cloudError,
      };
    }
  }

  const record = await persistWithAdapter(
    sessionStorageAdapter,
    presentation,
    draft,
  );

  return {
    record,
    storageBackend: "session",
    usedCloudFallback: false,
  };
}

export async function loadGeneratedHomeCarePlan(
  homeownerSlug: string,
  propertySlug: string,
): Promise<HomeCarePlanData | null> {
  let record: PersistedHomeCarePlan | null = null;

  if (isCloudPersistenceConnected() && typeof window !== "undefined") {
    try {
      const params = new URLSearchParams({ homeownerSlug, propertySlug });
      const result = await callHomeCarePlanApi<{
        record: PersistedHomeCarePlan | null;
      }>(`?${params.toString()}`);
      record = result.record;
    } catch (error) {
      console.warn("[persistence] Authenticated cloud load failed:", error);
    }
  } else {
    record = await getPersistenceAdapter().getHomeCarePlanBySlugs(
      homeownerSlug,
      propertySlug,
    );
  }

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
  if (isCloudPersistenceConnected() && typeof window !== "undefined") {
    const params = new URLSearchParams({ homeownerSlug, propertySlug });
    await callHomeCarePlanApi<{ ok: true }>(`?${params.toString()}`, {
      method: "DELETE",
    });
  } else {
    await getPersistenceAdapter().deleteHomeCarePlan(
      homeownerSlug,
      propertySlug,
    );
  }

  if (isCloudPersistenceConnected()) {
    await sessionStorageAdapter.deleteHomeCarePlan(homeownerSlug, propertySlug);
  }
}

export async function listGeneratedHomeCarePlans(): Promise<PersistedHomeCarePlan[]> {
  if (isCloudPersistenceConnected() && typeof window !== "undefined") {
    const result = await callHomeCarePlanApi<{
      records: PersistedHomeCarePlan[];
    }>("?list=1");
    return result.records;
  }

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
