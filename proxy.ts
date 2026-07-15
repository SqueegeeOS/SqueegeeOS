import type { NextRequest } from "next/server";
import { refreshHqSupabaseSession } from "@/lib/auth/supabase-proxy";

export async function proxy(request: NextRequest) {
  return refreshHqSupabaseSession(request);
}

export const config = {
  matcher: [
    "/hq/:path*",
    "/api/admin/care-operations/:path*",
    "/auth/hq/request",
    "/auth/hq/callback",
  ],
};
