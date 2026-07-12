"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { AdminDashboardData } from "@/lib/admin/closed-jobs-types";
import {
  buildLocalFallbackDashboard,
  mergeOperatingDashboard,
} from "@/lib/admin/merge-operating-dashboard";
import { loadLocalClosedJobs } from "@/lib/admin/closed-jobs-store";

interface UseOperatingDashboardResult {
  dashboard: AdminDashboardData | null;
  loading: boolean;
  unauthorized: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
}

/**
 * Shared HQ + employee dashboard loader.
 * Uses the same `/api/admin/overview` pipeline as Headquarters.
 */
export function useOperatingDashboard(): UseOperatingDashboardResult {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const localJobs = loadLocalClosedJobs();
      const response = await fetch("/api/admin/overview", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });

      if (response.status === 401) {
        setUnauthorized(true);
        setDashboard(null);
        return;
      }

      setUnauthorized(false);

      if (!response.ok) {
        throw new Error("Failed to load operating dashboard");
      }

      const serverData = (await response.json()) as AdminDashboardData;
      setDashboard(mergeOperatingDashboard(serverData, localJobs));
    } catch (err) {
      const localJobs = loadLocalClosedJobs();
      if (localJobs.length > 0) {
        setDashboard(buildLocalFallbackDashboard());
        setUnauthorized(false);
      } else {
        setDashboard(null);
        setError(
          err instanceof Error ? err.message : "Failed to load operating dashboard",
        );
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    dashboard,
    loading,
    unauthorized,
    error,
    refresh,
  };
}
