import { NextResponse } from "next/server";
import { loadMemberPortalPageByToken } from "@/lib/membership/load-member-portal-page";
import { pwaConfig } from "@/lib/pwa/config";

const ICONS = [
  { src: "/icons/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
  { src: "/icons/icon-512x512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
  { src: "/icons/icon-maskable-512x512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
];

function manifestBody(startUrl: string, id: string) {
  return {
    id,
    name: pwaConfig.name,
    short_name: pwaConfig.shortName,
    description: pwaConfig.description,
    start_url: startUrl,
    scope: pwaConfig.scope,
    display: pwaConfig.display,
    background_color: pwaConfig.backgroundColor,
    theme_color: pwaConfig.themeColor,
    orientation: "portrait",
    icons: ICONS,
  };
}

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

  let startUrl = pwaConfig.startUrl as string;
  let id = pwaConfig.startUrl as string;

  if (trimmed && /^[A-Za-z0-9_-]{8,128}$/.test(trimmed)) {
    try {
      const model = await loadMemberPortalPageByToken(trimmed);
      if (model) {
        startUrl = `/portal/${trimmed}`;
        id = `/portal/${trimmed}`;
      }
    } catch {
      // fall through to the generic manifest
    }
  }

  return NextResponse.json(manifestBody(startUrl, id), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "private, max-age=600",
    },
  });
}
