import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  compareProfileUpdatedAt,
  isBlankHeadquartersProfile,
  pickNewerBaseline,
} from "@/lib/admin/headquarters-profile-server";
import {
  loadLegacyBaseline,
  saveLocalLegacyBaseline,
  type LegacyBaseline,
} from "@/lib/admin/legacy-baseline";

export type HeadquartersProfileSource = "supabase" | "local" | "migrated";

export interface HeadquartersSyncResult {
  baseline: LegacyBaseline;
  source: HeadquartersProfileSource;
  cloudAvailable: boolean;
  warning?: string;
}

interface HeadquartersProfileApiResponse {
  profile: LegacyBaseline | null;
  storage: "supabase" | "none" | "local";
  warning?: string;
  error?: string;
  message?: string;
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
      warning: "Could not reach cloud headquarters profile",
    };
  }
}

async function saveCloudProfile(
  baseline: LegacyBaseline,
): Promise<HeadquartersProfileApiResponse> {
  try {
    const response = await fetch("/api/admin/headquarters-profile", {
      method: "PUT",
      headers: getAdminRequestHeaders(),
      body: JSON.stringify({
        profile: baseline,
        expectedUpdatedAt: baseline.updatedAt,
      }),
    });

    const json = (await response.json()) as HeadquartersProfileApiResponse;

    if (!response.ok) {
      if (response.status === 409 && json.profile) {
        return {
          profile: json.profile,
          storage: "supabase",
          warning: json.error,
        };
      }

      return {
        profile: null,
        storage: "local",
        warning: json.error ?? "Cloud save failed — kept local copy only",
      };
    }

    return json;
  } catch {
    return {
      profile: null,
      storage: "local",
      warning: "Cloud save failed — kept local copy only",
    };
  }
}

export async function syncHeadquartersProfile(): Promise<HeadquartersSyncResult> {
  const local = loadLegacyBaseline();
  const cloudResponse = await fetchCloudProfile();
  const cloud = cloudResponse.profile;

  if (cloud?.onboardingComplete) {
    const winner = pickNewerBaseline(cloud, local);

    if (
      !isBlankHeadquartersProfile(local) &&
      compareProfileUpdatedAt(local.updatedAt, cloud.updatedAt) > 0
    ) {
      const migrated = await saveCloudProfile(winner);
      const baseline = migrated.profile ?? winner;
      saveLocalLegacyBaseline(baseline);
      return {
        baseline,
        source: migrated.profile ? "migrated" : "local",
        cloudAvailable: Boolean(migrated.profile),
        warning: migrated.warning ?? cloudResponse.warning,
      };
    }

    saveLocalLegacyBaseline(cloud);
    return {
      baseline: cloud,
      source: "supabase",
      cloudAvailable: true,
      warning: cloudResponse.warning,
    };
  }

  if (!cloud && !isBlankHeadquartersProfile(local)) {
    const migrated = await saveCloudProfile(local);
    const baseline = migrated.profile ?? saveLocalLegacyBaseline(local);
    return {
      baseline,
      source: migrated.profile ? "migrated" : "local",
      cloudAvailable: Boolean(migrated.profile),
      warning: migrated.warning ?? cloudResponse.warning,
    };
  }

  if (cloud) {
    saveLocalLegacyBaseline(cloud);
    return {
      baseline: cloud,
      source: cloud.onboardingComplete ? "supabase" : "local",
      cloudAvailable: true,
      warning: cloudResponse.warning,
    };
  }

  return {
    baseline: local,
    source: "local",
    cloudAvailable: false,
    warning: cloudResponse.warning,
  };
}

export async function persistHeadquartersProfile(
  baseline: LegacyBaseline,
): Promise<HeadquartersSyncResult> {
  const normalized = saveLocalLegacyBaseline(baseline);
  const saved = await saveCloudProfile(normalized);

  if (saved.profile) {
    saveLocalLegacyBaseline(saved.profile);
    return {
      baseline: saved.profile,
      source: "supabase",
      cloudAvailable: true,
      warning: saved.warning,
    };
  }

  return {
    baseline: normalized,
    source: "local",
    cloudAvailable: false,
    warning:
      saved.warning ??
      "Saved on this device only. Run migrations/003_headquarters_profile.sql in Supabase.",
  };
}
