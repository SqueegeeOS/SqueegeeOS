import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return key;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Browser/client-side Supabase instance */
export function createBrowserSupabaseClient(): SupabaseClient {
  if (typeof window === "undefined") {
    return createClient(getSupabaseUrl(), getSupabaseAnonKey());
  }

  if (!browserClient) {
    browserClient = createClient(getSupabaseUrl(), getSupabaseAnonKey());
  }

  return browserClient;
}

/** Server-side Supabase instance (API routes, server components).
 * Uses the service role when configured so RLS can deny the anon key on HQ tables.
 * Falls back to anon only for local dev without SUPABASE_SERVICE_ROLE_KEY. */
export function createServerSupabaseClient(): SupabaseClient {
  if (isServiceRoleConfigured()) {
    return createServiceRoleSupabaseClient();
  }
  return createClient(getSupabaseUrl(), getSupabaseAnonKey());
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** Server-only privileged client — storage uploads and signed agreement URLs. */
export function createServiceRoleSupabaseClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
