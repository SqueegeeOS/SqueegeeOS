"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  DEFAULT_COMPANY_SETTINGS,
  normalizeCompanySettings,
  type CompanySettings,
} from "@/lib/pricing/company-settings";
import {
  fetchPricingSettingsClient,
  PRICING_SETTINGS_CACHE_KEY,
  savePricingSettingsClient,
} from "@/lib/pricing/pricing-settings-client";

interface PricingSettingsContextValue {
  settings: CompanySettings;
  loading: boolean;
  storage: "supabase" | "cache" | "local" | "default";
  updatedAt: string | null;
  saveSettings: (next: CompanySettings) => Promise<{ error?: string }>;
  refresh: () => Promise<void>;
}

const PricingSettingsContext = createContext<PricingSettingsContextValue | null>(
  null,
);

export function PricingSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [storage, setStorage] = useState<PricingSettingsContextValue["storage"]>("default");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchPricingSettingsClient();
    setSettings(result.settings);
    setStorage(result.storage);
    setUpdatedAt(result.updatedAt);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== PRICING_SETTINGS_CACHE_KEY || !event.newValue) {
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue) as CompanySettings;
        setSettings(normalizeCompanySettings(parsed));
      } catch {
        // ignore
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const saveSettings = useCallback(async (next: CompanySettings) => {
    const result = await savePricingSettingsClient(next, getAdminRequestHeaders());
    setSettings(result.settings);
    setStorage(result.storage);
    setUpdatedAt(new Date().toISOString());
    return { error: result.error };
  }, []);

  const value = useMemo(
    () => ({
      settings,
      loading,
      storage,
      updatedAt,
      saveSettings,
      refresh,
    }),
    [settings, loading, storage, updatedAt, saveSettings, refresh],
  );

  return (
    <PricingSettingsContext.Provider value={value}>
      {children}
    </PricingSettingsContext.Provider>
  );
}

export function useCompanySettings(): PricingSettingsContextValue {
  const ctx = useContext(PricingSettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_COMPANY_SETTINGS,
      loading: false,
      storage: "default",
      updatedAt: null,
      saveSettings: async () => ({ error: "PricingSettingsProvider not mounted" }),
      refresh: async () => {},
    };
  }
  return ctx;
}
