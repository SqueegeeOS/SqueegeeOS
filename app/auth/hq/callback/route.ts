import { NextResponse } from "next/server";
import { resolveSafeHqNextPath } from "@/lib/auth/hq-navigation";
import { createCookieAwareSupabaseServerClient } from "@/lib/auth/supabase-server";
import { HQ_AUTH_RESPONSE_HEADERS } from "@/lib/auth/hq-response-headers";

export const runtime = "nodejs";

function loginRedirect(request: Request, status?: string) {
  const url = new URL("/auth/hq", request.url);
  if (status) url.searchParams.set("status", status);
  return NextResponse.redirect(url, {
    headers: HQ_AUTH_RESPONSE_HEADERS,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = resolveSafeHqNextPath(url.searchParams.get("next"));
  if (!code) return loginRedirect(request, "access_unavailable");

  try {
    const supabase = await createCookieAwareSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return loginRedirect(request, "access_unavailable");
    return NextResponse.redirect(new URL(nextPath, request.url), {
      headers: HQ_AUTH_RESPONSE_HEADERS,
    });
  } catch {
    return loginRedirect(request, "service_unavailable");
  }
}
