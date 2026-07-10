import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isAtlasThemeId, type AtlasThemeId } from "@/lib/theme/atlas-themes";
import { resolvePortalAccessByToken } from "@/lib/persistence/queries/portal-access";
import { isMissingColumnError } from "@/lib/persistence/queries/load-membership-portal-row";

export interface PortalThemeContext {
  membershipId: string;
  theme: AtlasThemeId | null;
}

async function loadThemeForMembershipId(
  membershipId: string,
): Promise<AtlasThemeId | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("portal_theme")
    .eq("id", membershipId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error.message, "portal_theme")) {
      return null;
    }
    throw new Error(error.message);
  }

  const raw = data?.portal_theme;
  return isAtlasThemeId(raw) ? raw : null;
}

export async function getPortalThemeByToken(
  token: string,
): Promise<PortalThemeContext | null> {
  const access = await resolvePortalAccessByToken(token);
  if (!access) return null;

  const theme = await loadThemeForMembershipId(access.membershipId);
  return { membershipId: access.membershipId, theme };
}

export async function getPortalThemeBySlugs(
  homeownerSlug: string,
  propertySlug: string,
): Promise<PortalThemeContext | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServerSupabaseClient();
  const { data: homeowner, error: homeownerError } = await supabase
    .from("homeowners")
    .select("id")
    .eq("slug", homeownerSlug.trim())
    .maybeSingle();

  if (homeownerError || !homeowner) return null;

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("homeowner_id", homeowner.id)
    .eq("slug", propertySlug.trim())
    .maybeSingle();

  if (propertyError || !property) return null;

  const themed = await supabase
    .from("memberships")
    .select("id, portal_theme")
    .eq("property_id", property.id)
    .maybeSingle();

  if (!themed.error && themed.data?.id) {
    const raw = themed.data.portal_theme;
    return {
      membershipId: themed.data.id as string,
      theme: isAtlasThemeId(raw) ? raw : null,
    };
  }

  if (
    themed.error &&
    isMissingColumnError(themed.error.message, "portal_theme")
  ) {
    const base = await supabase
      .from("memberships")
      .select("id")
      .eq("property_id", property.id)
      .maybeSingle();

    if (base.error || !base.data?.id) return null;
    return { membershipId: base.data.id as string, theme: null };
  }

  if (themed.error) {
    throw new Error(themed.error.message);
  }

  return null;
}

export async function savePortalThemeForMembership(
  membershipId: string,
  theme: AtlasThemeId,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("memberships")
    .update({ portal_theme: theme })
    .eq("id", membershipId);

  if (error) {
    if (isMissingColumnError(error.message, "portal_theme")) {
      return false;
    }
    throw new Error(error.message);
  }

  return true;
}
