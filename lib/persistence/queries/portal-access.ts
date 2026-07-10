import {
  createPrivilegedServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { buildPortalAccessUrl } from "@/lib/membership/portal-access";

export interface PortalAccessContext {
  membershipId: string;
  homeownerSlug: string;
  propertySlug: string;
  portalAccessToken: string;
}

interface PortalAccessRow {
  id: string;
  portal_access_token: string;
  homeowners: { slug: string } | { slug: string }[] | null;
  properties: { slug: string } | { slug: string }[] | null;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function resolvePortalAccessByToken(
  token: string,
): Promise<PortalAccessContext | null> {
  const normalized = token.trim();
  if (!normalized || !isSupabaseConfigured()) {
    return null;
  }

  const supabase = createPrivilegedServerSupabaseClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, portal_access_token, homeowners!inner(slug), properties!inner(slug)",
    )
    .eq("portal_access_token", normalized)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as PortalAccessRow;
  const homeownerSlug = firstRelation(row.homeowners)?.slug;
  const propertySlug = firstRelation(row.properties)?.slug;

  if (!homeownerSlug || !propertySlug || !row.portal_access_token) {
    return null;
  }

  return {
    membershipId: row.id,
    homeownerSlug,
    propertySlug,
    portalAccessToken: row.portal_access_token,
  };
}

export async function getPortalAccessUrlForMembership(
  membershipId: string,
  origin?: string | null,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPrivilegedServerSupabaseClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("portal_access_token")
    .eq("id", membershipId)
    .maybeSingle();

  if (error || !data?.portal_access_token) {
    return null;
  }

  return buildPortalAccessUrl(data.portal_access_token as string, origin);
}
