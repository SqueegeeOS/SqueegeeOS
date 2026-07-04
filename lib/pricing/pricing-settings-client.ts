import {
  DEFAULT_COMPANY_SETTINGS,
  normalizeCompanySettings,
  type CompanySettings,
} from "./company-settings";

export const PRICING_SETTINGS_CACHE_KEY = "homeatlas:company-pricing-settings";

export function readCachedPricingSettings(): CompanySettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PRICING_SETTINGS_CACHE_KEY);
    if (!raw) return null;
    return normalizeCompanySettings(JSON.parse(raw) as Partial<CompanySettings>);
  } catch {
    return null;
  }
}

export function writeCachedPricingSettings(settings: CompanySettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PRICING_SETTINGS_CACHE_KEY,
    JSON.stringify(normalizeCompanySettings(settings)),
  );
}

export async function fetchPricingSettingsClient(): Promise<{
  settings: CompanySettings;
  storage: "supabase" | "cache" | "default";
  updatedAt: string | null;
}> {
  try {
    const response = await fetch("/api/pricing/settings", { cache: "no-store" });
    if (response.ok) {
      const json = (await response.json()) as {
        settings: CompanySettings;
        updatedAt?: string | null;
        storage?: string;
      };
      const settings = normalizeCompanySettings(json.settings);
      writeCachedPricingSettings(settings);
      return {
        settings,
        storage: json.storage === "supabase" ? "supabase" : "default",
        updatedAt: json.updatedAt ?? null,
      };
    }
  } catch {
    // fall through to cache
  }

  const cached = readCachedPricingSettings();
  if (cached) {
    return { settings: cached, storage: "cache", updatedAt: null };
  }

  return { settings: DEFAULT_COMPANY_SETTINGS, storage: "default", updatedAt: null };
}

export async function savePricingSettingsClient(
  settings: CompanySettings,
  headers: HeadersInit,
): Promise<{
  settings: CompanySettings;
  storage: "supabase" | "local";
  error?: string;
}> {
  const normalized = normalizeCompanySettings(settings);
  writeCachedPricingSettings(normalized);

  try {
    const response = await fetch("/api/admin/pricing-settings", {
      method: "PUT",
      headers,
      body: JSON.stringify({ settings: normalized }),
    });

    const json = (await response.json()) as {
      settings?: CompanySettings;
      storage?: string;
      error?: string;
    };

    if (response.ok && json.settings) {
      const saved = normalizeCompanySettings(json.settings);
      writeCachedPricingSettings(saved);
      return {
        settings: saved,
        storage: json.storage === "supabase" ? "supabase" : "local",
      };
    }

    return {
      settings: normalized,
      storage: "local",
      error: json.error ?? "Cloud save failed — saved on this device only",
    };
  } catch {
    return {
      settings: normalized,
      storage: "local",
      error: "Could not reach server — saved on this device only",
    };
  }
}
