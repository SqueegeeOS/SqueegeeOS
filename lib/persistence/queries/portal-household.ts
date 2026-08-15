import "server-only";

import { buildPortalAccessPath } from "@/lib/membership/portal-access";
import type {
  PortalHouseholdProperty,
  PortalHouseholdSnapshot,
} from "@/lib/membership/portal-household";
import type { MembershipStatus } from "@/lib/persistence/types/membership";
import type { PortalAccessContext } from "@/lib/persistence/queries/portal-access";
import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";

const HOUSEHOLD_PROPERTY_LIMIT = 25;
const CURRENT_MEMBERSHIP_STATUSES: MembershipStatus[] = [
  "pending_checkout",
  "pending_payment",
  "active",
  "paused",
];

interface HouseholdPropertyRow {
  id: string;
  property_id: string;
  plan_name: string;
  status: MembershipStatus;
  portal_access_token: string | null;
  properties:
    | {
        id: string;
        name: string;
        address: string;
        city: string;
        state: string;
        zip: string;
      }
    | {
        id: string;
        name: string;
        address: string;
        city: string;
        state: string;
        zip: string;
      }[]
    | null;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function addressLabel(property: {
  address: string;
  city: string;
  state: string;
  zip: string;
}): string {
  const locality = [property.city, property.state, property.zip]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return [property.address?.trim(), locality].filter(Boolean).join(", ");
}

/**
 * Projects only current memberships attached to the homeowner proven by the
 * supplied portal token. Each link uses that property's canonical token so
 * all downstream portal actions retain their existing membership boundary.
 */
export async function loadPortalHouseholdSnapshot(
  access: PortalAccessContext,
): Promise<PortalHouseholdSnapshot> {
  const supabase = createPrivilegedServerSupabaseClient();
  const result = await supabase
    .from("memberships")
    .select(
      "id, property_id, plan_name, status, portal_access_token, properties!inner(id, name, address, city, state, zip)",
    )
    .eq("homeowner_id", access.homeownerId)
    .in("status", CURRENT_MEMBERSHIP_STATUSES)
    .not("portal_access_token", "is", null)
    .order("created_at", { ascending: false })
    .limit(HOUSEHOLD_PROPERTY_LIMIT + 1);
  if (result.error) throw new Error(result.error.message);

  const rows = (result.data ?? []) as HouseholdPropertyRow[];
  const properties = rows
    .slice(0, HOUSEHOLD_PROPERTY_LIMIT)
    .map((row): PortalHouseholdProperty | null => {
      const property = firstRelation(row.properties);
      const portalToken = row.portal_access_token?.trim();
      if (!property || !portalToken || property.id !== row.property_id) {
        return null;
      }
      return {
        membershipId: row.id,
        propertyId: row.property_id,
        name: property.name?.trim() || "HomeAtlas property",
        address: addressLabel(property),
        planName: row.plan_name?.trim() || "HomeAtlas care",
        status: row.status,
        href: buildPortalAccessPath(portalToken),
        current: row.id === access.membershipId,
      };
    })
    .filter((property): property is PortalHouseholdProperty => property !== null)
    .sort((left, right) => {
      if (left.current !== right.current) return left.current ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

  return {
    properties,
    truncated: rows.length > HOUSEHOLD_PROPERTY_LIMIT,
  };
}
