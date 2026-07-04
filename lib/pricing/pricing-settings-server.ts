import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/persistence/supabase/client";
import {
  DEFAULT_COMPANY_SETTINGS,
  normalizeCompanySettings,
  type CompanySettings,
} from "./company-settings";

export const PRICING_SETTINGS_ROW_ID = "default";

interface PricingSettingsRow {
  id: string;
  settings: CompanySettings;
  updated_at: string;
}

function isMissingTableError(message: string, code?: string): boolean {
  return (
    message.includes("does not exist") ||
    message.includes("pricing_settings") ||
    code === "PGRST205"
  );
}

export async function fetchPricingSettingsFromSupabase(): Promise<{
  settings: CompanySettings;
  updatedAt: string | null;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { settings: DEFAULT_COMPANY_SETTINGS, updatedAt: null };
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("pricing_settings")
      .select("settings, updated_at")
      .eq("id", PRICING_SETTINGS_ROW_ID)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error.message, error.code)) {
        return {
          settings: DEFAULT_COMPANY_SETTINGS,
          updatedAt: null,
          error: "pricing_settings table missing — run migration 008",
        };
      }
      return {
        settings: DEFAULT_COMPANY_SETTINGS,
        updatedAt: null,
        error: error.message,
      };
    }

    if (!data) {
      return { settings: DEFAULT_COMPANY_SETTINGS, updatedAt: null };
    }

    const row = data as Pick<PricingSettingsRow, "settings" | "updated_at">;
    return {
      settings: normalizeCompanySettings(row.settings),
      updatedAt: row.updated_at,
    };
  } catch (error) {
    return {
      settings: DEFAULT_COMPANY_SETTINGS,
      updatedAt: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function upsertPricingSettingsToSupabase(
  settings: CompanySettings,
): Promise<{ settings: CompanySettings | null; updatedAt: string | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { settings: null, updatedAt: null, error: "Supabase not configured" };
  }

  const normalized = normalizeCompanySettings(settings);

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("pricing_settings")
      .upsert(
        {
          id: PRICING_SETTINGS_ROW_ID,
          settings: normalized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select("settings, updated_at")
      .single();

    if (error) {
      if (isMissingTableError(error.message, error.code)) {
        return {
          settings: null,
          updatedAt: null,
          error: "pricing_settings table missing — run migration 008",
        };
      }
      return { settings: null, updatedAt: null, error: error.message };
    }

    const row = data as Pick<PricingSettingsRow, "settings" | "updated_at">;
    return {
      settings: normalizeCompanySettings(row.settings),
      updatedAt: row.updated_at,
    };
  } catch (error) {
    return {
      settings: null,
      updatedAt: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
