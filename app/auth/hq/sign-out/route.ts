import { NextResponse } from "next/server";
import { createCookieAwareSupabaseServerClient } from "@/lib/auth/supabase-server";
import { HQ_AUTH_RESPONSE_HEADERS } from "@/lib/auth/hq-response-headers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createCookieAwareSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return NextResponse.redirect(new URL("/auth/hq", request.url), {
      status: 303,
      headers: HQ_AUTH_RESPONSE_HEADERS,
    });
  } catch {
    return NextResponse.json(
      { error: "Sign out is temporarily unavailable" },
      { status: 503, headers: HQ_AUTH_RESPONSE_HEADERS },
    );
  }
}
