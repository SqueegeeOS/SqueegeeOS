import {
  createPrivilegedServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { buildPortalAccessUrl } from "@/lib/membership/portal-access";

export interface PortalAccessContext {
  membershipId: string;
  homeownerId: string;
  propertyId: string;
  memberName: string;
  homeownerSlug: string;
  propertySlug: string;
  portalAccessToken: string;
}

interface PortalAccessRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  portal_access_token: string;
  homeowners:
    | { id: string; slug: string; full_name: string }
    | { id: string; slug: string; full_name: string }[]
    | null;
  properties:
    | { id: string; homeowner_id: string; slug: string }
    | { id: string; homeowner_id: string; slug: string }[]
    | null;
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
      "id, homeowner_id, property_id, portal_access_token, homeowners!inner(id, slug, full_name), properties!inner(id, homeowner_id, slug)",
    )
    .eq("portal_access_token", normalized)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as PortalAccessRow;
  const homeowner = firstRelation(row.homeowners);
  const homeownerSlug = homeowner?.slug;
  const memberName = homeowner?.full_name;
  const property = firstRelation(row.properties);
  const propertySlug = property?.slug;

  if (
    !row.id ||
    !row.homeowner_id ||
    !row.property_id ||
    !homeowner?.id ||
    !property?.id ||
    row.homeowner_id !== homeowner.id ||
    row.property_id !== property.id ||
    property.homeowner_id !== homeowner.id ||
    !homeownerSlug ||
    !memberName ||
    !propertySlug ||
    row.portal_access_token !== normalized
  ) {
    return null;
  }

  return {
    membershipId: row.id,
    homeownerId: row.homeowner_id,
    propertyId: row.property_id,
    memberName,
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
