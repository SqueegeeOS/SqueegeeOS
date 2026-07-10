import { NextResponse } from "next/server";
import { isAtlasThemeId } from "@/lib/theme/atlas-themes";
import {
  getPortalThemeBySlugs,
  getPortalThemeByToken,
  savePortalThemeForMembership,
} from "@/lib/persistence/queries/portal-theme";

interface PortalThemeRequestBody {
  theme?: string;
  token?: string;
  homeownerSlug?: string;
  propertySlug?: string;
}

async function resolveMembership(
  body: PortalThemeRequestBody,
): Promise<{ membershipId: string } | null> {
  const token = body.token?.trim();
  if (token) {
    const ctx = await getPortalThemeByToken(token);
    return ctx ? { membershipId: ctx.membershipId } : null;
  }

  const homeownerSlug = body.homeownerSlug?.trim();
  const propertySlug = body.propertySlug?.trim();
  if (homeownerSlug && propertySlug) {
    const ctx = await getPortalThemeBySlugs(homeownerSlug, propertySlug);
    return ctx ? { membershipId: ctx.membershipId } : null;
  }

  return null;
}

/** Persist a member's saved portal atmosphere (Day / Night / Lux). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PortalThemeRequestBody;
    const theme = body.theme?.trim();

    if (!isAtlasThemeId(theme)) {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
    }

    const membership = await resolveMembership(body);
    if (!membership) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const saved = await savePortalThemeForMembership(
      membership.membershipId,
      theme,
    );

    return NextResponse.json({
      theme,
      saved,
      membershipId: membership.membershipId,
    });
  } catch {
    return NextResponse.json({ error: "Failed to save theme" }, { status: 500 });
  }
}
