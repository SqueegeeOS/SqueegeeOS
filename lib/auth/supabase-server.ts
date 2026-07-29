import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "@/lib/persistence/supabase/client";

/**
 * Creates one cookie-aware Supabase client for the current request.
 * Never cache or share this client across requests.
 */
export async function createCookieAwareSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as CookieOptions);
          });
        } catch {
          // Server Components cannot write cookies. The scoped Next.js Proxy
          // refreshes HQ sessions before the protected layout renders.
        }
      },
    },
  });
}
