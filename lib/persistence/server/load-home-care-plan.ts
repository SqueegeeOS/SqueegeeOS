import "server-only";

import { isHomeCarePlanCapability } from "@/lib/home-care-plan/presentation-capability";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

interface HomeCarePlanPresentationRow {
  presentation: HomeCarePlanData;
}

/**
 * Loads only the customer presentation document bound to one opaque plan UUID
 * and its two readable route labels. Archived and draft plans fail closed.
 */
export async function loadHomeCarePlanPresentationByCapability(
  capability: string,
  homeownerSlug: string,
  propertySlug: string,
): Promise<HomeCarePlanData | null> {
  if (
    !isCloudPersistenceConnected() ||
    !isHomeCarePlanCapability(capability) ||
    !homeownerSlug.trim() ||
    !propertySlug.trim()
  ) {
    return null;
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("home_care_plans")
    .select("presentation")
    .eq("id", capability.trim())
    .eq("homeowner_slug", homeownerSlug)
    .eq("property_slug", propertySlug)
    .in("status", ["generated", "published"])
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Home Care Plan presentation: ${error.message}`);
  }

  return data
    ? (data as HomeCarePlanPresentationRow).presentation
    : null;
}
