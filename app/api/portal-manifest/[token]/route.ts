import { NextResponse } from "next/server";
import { buildPortalManifest, genericPortalManifest } from "@/lib/pwa/portal-manifest";
import { startPortalTiming } from "@/lib/observability/portal-timing";
import { resolvePortalAccessByToken } from "@/lib/persistence/queries/portal-access";

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
  const timing = startPortalTiming("portal-manifest");
  const { token } = await params;
  const trimmed = token?.trim() ?? "";

  let body = genericPortalManifest();

  if (trimmed && trimmed !== "portal" && /^[A-Za-z0-9_-]{8,128}$/.test(trimmed)) {
    try {
      const access = await resolvePortalAccessByToken(trimmed);
      if (access) {
        body = buildPortalManifest(`/portal/${trimmed}`);
        timing.finish("success");
      } else {
        timing.finish("not-found");
      }
    } catch {
      timing.finish("error");
      // fall through to the generic manifest
    }
  } else {
    timing.finish("skipped");
  }

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "private, no-store",
    },
  });
}
