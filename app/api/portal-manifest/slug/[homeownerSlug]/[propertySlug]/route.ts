import { NextResponse } from "next/server";
import { loadMemberPortalPageBySlugs } from "@/lib/membership/load-member-portal-page";
import { buildPortalManifest, genericPortalManifest } from "@/lib/pwa/portal-manifest";

/** Per-property manifest for the slug-based portal. Invalid slugs fall back to generic. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ homeownerSlug: string; propertySlug: string }> },
) {
  const { homeownerSlug, propertySlug } = await params;
  const safe = /^[a-z0-9-]{1,80}$/;

  let body = genericPortalManifest();
  if (safe.test(homeownerSlug) && safe.test(propertySlug)) {
    try {
      const model = await loadMemberPortalPageBySlugs(homeownerSlug, propertySlug);
      if (model) {
        body = buildPortalManifest(`/homecare/${homeownerSlug}/${propertySlug}/portal`);
      }
    } catch {
      // generic fallback
    }
  }
  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "private, max-age=600",
    },
  });
}
