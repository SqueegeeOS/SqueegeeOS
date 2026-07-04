/**
 * Persistence configuration.
 *
 * Supabase is active when:
 * - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set
 * - NEXT_PUBLIC_SUPABASE_ENABLED=true
 * - NEXT_PUBLIC_PERSISTENCE_BACKEND=supabase (default when enabled)
 */
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import { isSupabaseConfigured } from "./supabase/client";

export const PERSISTENCE_CONFIG = {
  backend: (process.env.NEXT_PUBLIC_PERSISTENCE_BACKEND ??
    (process.env.NEXT_PUBLIC_SUPABASE_ENABLED === "true" ? "supabase" : "session")) as
    | "session"
    | "supabase",
  supabaseEnabled: process.env.NEXT_PUBLIC_SUPABASE_ENABLED === "true",
} as const;

export function isCloudPersistenceConnected(): boolean {
  return (
    isSupabaseConfigured() &&
    PERSISTENCE_CONFIG.supabaseEnabled &&
    PERSISTENCE_CONFIG.backend === "supabase"
  );
}

export function getActivePersistenceBackend(): "session" | "supabase" {
  if (isCloudPersistenceConnected()) {
    return "supabase";
  }
  return "session";
}

export const PERSISTENCE_UI_COPY = {
  localNotice:
    "Stored locally in this browser until cloud storage is connected.",
  localBadge: "Local Storage Only",
  localFallback:
    "Loaded from local browser cache — cloud copy not found for this plan.",
  cloudConnected: `Saved to ${PLATFORM_BRAND.name} cloud`,
  cloudBadge: "Cloud Storage",
} as const;
