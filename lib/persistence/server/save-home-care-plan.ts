import "server-only";

import type { HomeCarePlanDraft } from "@/lib/home-care-plan/create-types";
import { applyAtlasPricingToHomeCarePlanDraft } from "@/lib/home-care-plan/atlas-pricing";
import { customerAuthoritySlugSuffix } from "@/lib/home-care-plan/authority-slug";
import { buildHomeCarePlanFromDraft } from "@/lib/home-care-plan/builder";
import {
  homeownerInputFromPresentation,
  propertyInputFromPresentation,
} from "@/lib/persistence/mappers/home-care-plan";
import {
  homeCarePlanFromRow,
  type HomeCarePlanRow,
} from "@/lib/persistence/supabase/mappers";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { PersistedHomeCarePlan } from "@/lib/persistence/types";
import { fetchPricingSettingsFromSupabase } from "@/lib/pricing/pricing-settings-server";

export async function saveHomeCarePlanFromAuthorizedDraft(
  draft: HomeCarePlanDraft,
): Promise<PersistedHomeCarePlan> {
  const pricingSettings = await fetchPricingSettingsFromSupabase();
  if (pricingSettings.error) {
    throw new Error(
      `Atlas Pricing Engine settings unavailable: ${pricingSettings.error}`,
    );
  }
  const authoritativeDraft = applyAtlasPricingToHomeCarePlanDraft(
    draft,
    pricingSettings.settings,
  );
  const builtPresentation = buildHomeCarePlanFromDraft(authoritativeDraft);
  const sourceSuffix = customerAuthoritySlugSuffix({
    fullName: authoritativeDraft.homeowner.fullName,
    email: authoritativeDraft.homeowner.email,
    propertyName: authoritativeDraft.property.name,
    address: authoritativeDraft.property.address,
  });
  const presentation = {
    ...builtPresentation,
    homeowner: {
      ...builtPresentation.homeowner,
      slug: `${builtPresentation.homeowner.slug}-${sourceSuffix}`,
    },
    property: {
      ...builtPresentation.property,
      slug: `${builtPresentation.property.slug}-${sourceSuffix}`,
    },
  };
  const homeowner = homeownerInputFromPresentation(presentation, {
    email: authoritativeDraft.homeowner.email,
    phone: authoritativeDraft.homeowner.phone,
  });
  const property = propertyInputFromPresentation(
    presentation,
    "resolved-in-transaction",
    {
      zip: authoritativeDraft.property.zip,
      type: authoritativeDraft.property.propertyType,
    },
  );
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .rpc("save_hq_home_care_plan", {
      p_homeowner_slug: homeowner.slug,
      p_homeowner_full_name: homeowner.fullName,
      p_homeowner_first_name: homeowner.firstName,
      p_homeowner_email: homeowner.email,
      p_homeowner_phone: homeowner.phone,
      p_property_slug: property.slug,
      p_property_name: property.name,
      p_property_address: property.address,
      p_property_city: property.city,
      p_property_state: property.state,
      p_property_zip: property.zip,
      p_property_type: property.type,
      p_property_hero_image: property.heroImage,
      p_property_home_care_score: property.homeCareScore,
      p_property_year_built: property.yearBuilt,
      p_property_narrative: property.narrative,
      p_presentation: presentation,
      p_draft: authoritativeDraft,
    })
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save Home Care Plan: ${error?.message ?? "empty response"}`,
    );
  }

  return homeCarePlanFromRow(data as HomeCarePlanRow);
}
