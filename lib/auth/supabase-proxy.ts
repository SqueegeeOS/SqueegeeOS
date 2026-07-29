import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { applyHqAuthResponseHeaders } from "@/lib/auth/hq-response-headers";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "@/lib/persistence/supabase/client";

interface ProxyCookieOptions {
  cookies: {
    getAll(): { name: string; value: string }[];
    setAll(
      cookies: {
        name: string;
        value: string;
        options: Record<string, unknown>;
      }[],
      headers: Record<string, string>,
    ): void;
  };
}

interface ProxyAuthClient {
  auth: { getUser(): Promise<unknown> };
}

type ProxyClientFactory = (
  url: string,
  anonKey: string,
  options: ProxyCookieOptions,
) => ProxyAuthClient;

export interface HqProxyDependencies {
  createClient?: ProxyClientFactory;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  emergencyDisabled?: boolean;
}

function unavailableResponse(): NextResponse {
  const response = new NextResponse("Headquarters access is unavailable", {
    status: 503,
  });
  applyHqAuthResponseHeaders(response.headers);
  return response;
}

export async function refreshHqSupabaseSession(
  request: NextRequest,
  dependencies: HqProxyDependencies = {},
) {
  const emergencyDisabled =
    dependencies.emergencyDisabled ??
    process.env.HQ_AUTH_EMERGENCY_DISABLED === "1";
  if (emergencyDisabled) return unavailableResponse();

  let response = NextResponse.next({ request });

  try {
    const createClient =
      dependencies.createClient ??
      (createServerClient as unknown as ProxyClientFactory);
    const supabase = createClient(
      dependencies.supabaseUrl ?? getSupabaseUrl(),
      dependencies.supabaseAnonKey ?? getSupabaseAnonKey(),
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
            Object.entries(headers).forEach(([name, value]) =>
              response.headers.set(name, value),
            );
          },
        },
      },
    );

    // Refresh only. The protected layout and route handlers perform the
    // authoritative Auth getUser + hq_admin_users lookup.
    await supabase.auth.getUser();
    applyHqAuthResponseHeaders(response.headers);
    return response;
  } catch {
    return unavailableResponse();
  }
}
