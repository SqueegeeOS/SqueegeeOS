import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  clearLocalHeadquartersDraft,
  markLocalDraftImported,
  readLocalHeadquartersDraft,
  wasLocalDraftImported,
} from "@/lib/admin/headquarters-local-draft";
import {
  compareProfileUpdatedAt,
  isBlankHeadquartersProfile,
} from "@/lib/admin/headquarters-profile-server";
import { setHeadquartersSessionBaseline, getHeadquartersSessionBaseline } from "@/lib/admin/headquarters-profile-session";
import {
  EMPTY_LEGACY_BASELINE,
  isHeadquartersInitialized,
  legacyBaselineHasHistory,
  normalizeLegacyBaseline,
  type LegacyBaseline,
} from "@/lib/admin/legacy-baseline";

export type HeadquartersProfileSource =
  | "supabase"
  | "migrated"
  | "none"
  | "local_draft";

export interface HeadquartersSyncResult {
  baseline: LegacyBaseline;
  source: HeadquartersProfileSource;
  cloudAvailable: boolean;
  databaseHealthy: boolean;
  warning?: string;
  pendingLocalImport?: boolean;
  localDraft?: LegacyBaseline | null;
  needsSchemaSetup?: boolean;
}

interface HeadquartersProfileApiResponse {
  profile: LegacyBaseline | null;
  storage: "supabase" | "none" | "local";
  healthy?: boolean;
  schemaReady?: boolean;
  warning?: string;
  error?: string;
  message?: string;
}

async function ensureCloudSchema(): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/headquarters-profile/migrate", {
      method: "POST",
      headers: getAdminRequestHeaders(),
    });
    if (!response.ok) return false;
    const json = (await response.json()) as { schemaReady?: boolean };
    return Boolean(json.schemaReady);
  } catch {
    return false;
  }
}

function normalizeForCloudSave(baseline: LegacyBaseline): LegacyBaseline {
  return normalizeLegacyBaseline({
    ...baseline,
    configured: true,
    headquartersInitialized: true,
    onboardingComplete: true,
    fiveStarReviews: baseline.googleReviews,
    homesProtected: baseline.homesServed,
    activeMembers: baseline.recurringCustomers || baseline.activeMembers,
    updatedAt: new Date().toISOString(),
  });
}

function finalizeBaseline(baseline: LegacyBaseline): LegacyBaseline {
  const normalized = normalizeLegacyBaseline({
    ...baseline,
    configured: true,
    headquartersInitialized: isHeadquartersInitialized(baseline),
    onboardingComplete: Boolean(
      baseline.onboardingComplete || baseline.headquartersInitialized,
    ),
  });
  setHeadquartersSessionBaseline(normalized);
  return normalized;
}

async function fetchCloudProfile(): Promise<HeadquartersProfileApiResponse> {
  try {
    const response = await fetch("/api/admin/headquarters-profile", {
      headers: getAdminRequestHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as
        | HeadquartersProfileApiResponse
        | { error?: string }
        | null;
      return {
        profile: null,
        storage: "none",
        healthy: false,
        warning:
          (json && "error" in json && json.error) ||
          "Could not load cloud headquarters profile",
      };
    }

    return (await response.json()) as HeadquartersProfileApiResponse;
  } catch {
    return {
      profile: null,
      storage: "none",
      healthy: false,
      schemaReady: false,
      warning: "Could not reach cloud headquarters profile",
    };
  }
}

async function saveCloudProfile(
  baseline: LegacyBaseline,
): Promise<HeadquartersProfileApiResponse> {
  const payload = normalizeForCloudSave(baseline);

  try {
    const response = await fetch("/api/admin/headquarters-profile", {
      method: "PUT",
      headers: getAdminRequestHeaders(),
      body: JSON.stringify({
        profile: payload,
        expectedUpdatedAt: payload.updatedAt,
      }),
    });

    const json = (await response.json()) as HeadquartersProfileApiResponse;

    if (!response.ok) {
      if (response.status === 409 && json.profile) {
        finalizeBaseline(json.profile);
        return {
          profile: json.profile,
          storage: "supabase",
          healthy: true,
          warning: json.error,
        };
      }

      return {
        profile: null,
        storage: "local",
        healthy: false,
        warning: json.error ?? "Cloud save failed",
      };
    }

    return json;
  } catch {
    return {
      profile: null,
      storage: "local",
      healthy: false,
      warning: "Cloud save failed",
    };
  }
}

async function saveCloudProfileAndFinalize(
  baseline: LegacyBaseline,
): Promise<HeadquartersProfileApiResponse> {
  const saved = await saveCloudProfile(baseline);
  if (saved.profile) {
    finalizeBaseline(saved.profile);
  }
  return saved;
}

function buildSyncResult(
  baseline: LegacyBaseline,
  options: Omit<HeadquartersSyncResult, "baseline">,
): HeadquartersSyncResult {
  return {
    baseline: finalizeBaseline(baseline),
    ...options,
  };
}

/**
 * Supabase is the single source of truth. localStorage drafts are never used
 * to decide whether Founder Setup should appear.
 */
export async function syncHeadquartersProfile(): Promise<HeadquartersSyncResult> {
  const localDraft = readLocalHeadquartersDraft();
  let cloudResponse = await fetchCloudProfile();

  if (cloudResponse.schemaReady === false) {
    const ensured = await ensureCloudSchema();
    if (ensured) {
      cloudResponse = await fetchCloudProfile();
    }
  }

  const cloud = cloudResponse.profile;
  const schemaReady = cloudResponse.schemaReady !== false;
  const databaseHealthy = Boolean(
    schemaReady && (cloudResponse.healthy ?? cloud),
  );

  if (!schemaReady) {
    return buildSyncResult(EMPTY_LEGACY_BASELINE, {
      source: "none",
      cloudAvailable: false,
      databaseHealthy: false,
      needsSchemaSetup: true,
      warning: cloudResponse.warning ?? cloudResponse.error,
    });
  }

  if (cloud && isHeadquartersInitialized(cloud)) {
    if (localDraft && wasLocalDraftImported()) {
      clearLocalHeadquartersDraft();
    }

    const localIsNewer =
      localDraft &&
      legacyBaselineHasHistory(localDraft) &&
      !wasLocalDraftImported() &&
      compareProfileUpdatedAt(localDraft.updatedAt, cloud.updatedAt) > 0;

    if (localIsNewer) {
      return buildSyncResult(cloud, {
        source: "supabase",
        cloudAvailable: true,
        databaseHealthy,
        warning: cloudResponse.warning,
        pendingLocalImport: true,
        localDraft,
      });
    }

    clearLocalHeadquartersDraft();
    markLocalDraftImported();
    return buildSyncResult(cloud, {
      source: "supabase",
      cloudAvailable: true,
      databaseHealthy,
      warning: cloudResponse.warning,
    });
  }

  if (
    localDraft &&
    !wasLocalDraftImported() &&
    (isHeadquartersInitialized(localDraft) || legacyBaselineHasHistory(localDraft))
  ) {
    const migrated = await saveCloudProfileAndFinalize({
      ...localDraft,
      headquartersInitialized: true,
      onboardingComplete: true,
    });

    if (migrated.profile && isHeadquartersInitialized(migrated.profile)) {
      markLocalDraftImported();
      return buildSyncResult(migrated.profile, {
        source: "migrated",
        cloudAvailable: true,
        databaseHealthy: true,
        warning: migrated.warning ?? cloudResponse.warning,
      });
    }

    return buildSyncResult(EMPTY_LEGACY_BASELINE, {
      source: "local_draft",
      cloudAvailable: true,
      databaseHealthy: false,
      warning:
        migrated.warning ??
        cloudResponse.warning ??
        "Local founder archive found but cloud import failed. Retry import.",
      pendingLocalImport: true,
      localDraft,
    });
  }

  if (cloud && !isBlankHeadquartersProfile(cloud)) {
    return buildSyncResult(cloud, {
      source: "supabase",
      cloudAvailable: true,
      databaseHealthy,
      warning: cloudResponse.warning,
    });
  }

  return buildSyncResult(EMPTY_LEGACY_BASELINE, {
    source: "none",
    cloudAvailable: databaseHealthy,
    databaseHealthy,
    warning: cloudResponse.warning,
  });
}

export async function importLocalHeadquartersDraft(): Promise<HeadquartersSyncResult> {
  const localDraft = readLocalHeadquartersDraft();
  if (!localDraft) {
    return buildSyncResult(getHeadquartersSessionBaseline(), {
      source: "none",
      cloudAvailable: false,
      databaseHealthy: false,
      warning: "No local draft found to import.",
    });
  }

  const saved = await saveCloudProfileAndFinalize({
    ...localDraft,
    headquartersInitialized: true,
    onboardingComplete: true,
  });

  if (saved.profile) {
    markLocalDraftImported();
    return buildSyncResult(saved.profile, {
      source: "migrated",
      cloudAvailable: true,
      databaseHealthy: true,
      warning: saved.warning,
    });
  }

  return buildSyncResult(getHeadquartersSessionBaseline(), {
    source: "local_draft",
    cloudAvailable: false,
    databaseHealthy: false,
    warning: saved.warning ?? "Import failed — cloud save did not succeed.",
    pendingLocalImport: true,
    localDraft,
  });
}

export async function persistHeadquartersProfile(
  baseline: LegacyBaseline,
): Promise<HeadquartersSyncResult> {
  const payload = normalizeForCloudSave({
    ...baseline,
    headquartersInitialized: true,
    onboardingComplete: true,
    configured: true,
  });

  const saved = await saveCloudProfile(payload);

  if (saved.profile) {
    markLocalDraftImported();
    return buildSyncResult(finalizeBaseline(saved.profile), {
      source: "supabase",
      cloudAvailable: true,
      databaseHealthy: true,
      warning: saved.warning,
    });
  }

  return {
    baseline: payload,
    source: "none",
    cloudAvailable: false,
    databaseHealthy: false,
    warning:
      saved.warning ??
      "Could not save to Supabase. Confirm Cloud Headquarters setup is complete.",
  };
}
