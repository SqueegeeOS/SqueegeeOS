import { NextResponse } from "next/server";
import { loadMemberPortalPageByToken } from "@/lib/membership/load-member-portal-page";
import { buildPortalManifest, genericPortalManifest } from "@/lib/pwa/portal-manifest";

/**
 * Per-member PWA manifest: installing from /portal/[token] bakes that exact
 * portal URL as the app's start_url, so the home-screen icon reopens the
 * member's own portal (installed PWAs get isolated storage on iOS, so the
 * stored-token redirect on /portal cannot be relied on).
 *
 * Unknown or expired tokens fall back to the generic /portal manifest —
 * never a fabricated member.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const trimmed = token?.trim() ?? "";

  let body = genericPortalManifest();

  if (trimmed && trimmed !== "portal" && /^[A-Za-z0-9_-]{8,128}$/.test(trimmed)) {
    try {
      const model = await loadMemberPortalPageByToken(trimmed);
      if (model) {
        body = buildPortalManifest(`/portal/${trimmed}`);
      }
    } catch {
      // fall through to the generic manifest
    }
  }

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "private, max-age=600",
    },
  });
}
