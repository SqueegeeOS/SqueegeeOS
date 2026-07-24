import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { formatPortalPropertyAddress } from "@/lib/membership/portal-address";
import {
  buildCareJourney,
  defaultHomeCareBrand,
  defaultMembershipBenefits,
  defaultPlanReviews,
  getPlanFounders,
  SQUEEGEEKING_PHONE,
} from "@/lib/home-care-plan/defaults";
import { NOAH_PERSONAL_NOTE } from "@/lib/team/founders";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  createHomeCarePlanRecord,
  presentationFromRecord,
} from "@/lib/persistence/mappers/home-care-plan";
import { loadGeneratedHomeCarePlan } from "@/lib/persistence/repository";
import {
  createPrivilegedServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { getPresentation } from "@/lib/presentations/repository";
import {
  tierVisitPriceForPresentation,
} from "@/lib/presentations/calculations";
import {
  firstNameFromFullName,
  parseClientAddress,
} from "@/lib/presentations/parse-client-address";
import type { PresentationData } from "@/lib/presentations/types";
import {
  formatTierPrice,
  normalizeToSqueegeeKingTier,
  type SqueegeeKingTierId,
  SQUEEGEEKING_TIERS,
  squeegeeKingTierLabel,
} from "@/lib/membership/tier-config";
import { defaultEnrollmentSavingsForTier } from "@/lib/membership/enrollment-savings";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BuildPortalHomeCarePlanInput {
  presentation: PresentationData;
  homeownerSlug: string;
  propertySlug: string;
  planName: string;
  agreementTier: SqueegeeKingTierId;
  visitPrice: number;
}

function formatStateName(state: string): string {
  const normalized = state.trim();
  if (normalized.length === 2) {
    const map: Record<string, string> = {
      CA: "California",
    };
    return map[normalized.toUpperCase()] ?? normalized;
  }
  return normalized || "California";
}

/**
 * Portal-facing Home Care Plan JSON — real presentation/property data only.
 * No fabricated visits, savings, timeline, or access/internal notes.
 */
export function buildPortalHomeCarePlanFromPresentation(
  input: BuildPortalHomeCarePlanInput,
): HomeCarePlanData {
  const parsed = parseClientAddress(
    input.presentation.clientAddress,
    input.presentation.clientName,
  );
  const firstName = firstNameFromFullName(input.presentation.clientName);
  const propertyName = parsed.propertyName;
  const displayAddress = formatPortalPropertyAddress({
    address: parsed.address,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
  });
  const propertyProfile: HomeCarePlanData["propertyProfile"] = [];

  if (input.presentation.homeSqft > 0) {
    propertyProfile.push({
      label: "Square Footage",
      value: `${input.presentation.homeSqft.toLocaleString()} sq ft`,
      detail: "From your home care assessment",
    });
  }

  propertyProfile.push({
    label: "Membership",
    value: input.planName,
    detail: `${squeegeeKingTierLabel(input.agreementTier)} care`,
  });

  return {
    homeowner: {
      firstName,
      fullName: input.presentation.clientName.trim() || "Member",
      slug: input.homeownerSlug,
    },
    property: {
      name: propertyName,
      slug: input.propertySlug,
      address: parsed.address,
      city: parsed.city,
      state: formatStateName(parsed.state),
      heroImage: "",
      yearBuilt: 0,
      homeCareScore: 0,
      lastVisit: "",
      membershipRecommendation: input.planName,
    },
    brand: {
      company: defaultHomeCareBrand.company,
      tagline: defaultHomeCareBrand.tagline,
      craftedFor: `Crafted for ${input.presentation.clientName.trim() || "you"}`,
      footerLines: [...defaultHomeCareBrand.footerLines],
    },
    hero: {
      title: "Your home is under care.",
      subheadline: `${displayAddress || propertyName} — ${squeegeeKingTierLabel(input.agreementTier)} membership.`,
      intro:
        "Your membership is active. Visits, photos, and your care record live here as service begins.",
      cta: "Open My Home",
    },
    propertyHealth: {
      rating: "Under care",
      narrative: `${displayAddress || propertyName} is under membership care. Your visit history begins with your first service visit.`,
    },
    propertyProfile,
    findings: [],
    recommendation: {
      headline: `Your ${input.planName} membership.`,
      paragraphs: [
        `${formatTierPrice(input.visitPrice)} per visit · billed on the 1st of your service month.`,
      ],
      closing:
        "Nothing to do at the door — your care team handles scheduling and follow-through.",
    },
    personalNote: {
      greeting: `${firstName},`,
      paragraphs: [
        "Thank you for trusting us with your home.",
        "Your private portal is ready whenever you are.",
      ],
      signoff: NOAH_PERSONAL_NOTE.signoff,
      title: NOAH_PERSONAL_NOTE.title,
      company: NOAH_PERSONAL_NOTE.company,
    },
    memberships: [
      {
        id: input.agreementTier,
        name: input.planName,
        price: formatTierPrice(input.visitPrice),
        visitPrice: input.visitPrice,
        period: "per visit",
        lifestyle: squeegeeKingTierLabel(input.agreementTier),
        highlighted: true,
      },
    ],
    careJourney: buildCareJourney(propertyName),
    membershipBenefits: [...defaultMembershipBenefits],
    team: getPlanFounders(),
    reviews: defaultPlanReviews,
    closing: {
      headline: `${displayAddress || propertyName} is under care.`,
      subline: "Your membership portal is ready.",
      phone: SQUEEGEEKING_PHONE,
      location: "Chico, California",
      cta: "Open My Home",
    },
  };
}

export async function persistPortalHomeCarePlan(
  supabase: SupabaseClient,
  input: {
    homeownerId: string;
    propertyId: string;
    homeownerSlug: string;
    propertySlug: string;
    plan: HomeCarePlanData;
  },
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase.from("home_care_plans").upsert(
    {
      homeowner_id: input.homeownerId,
      property_id: input.propertyId,
      homeowner_slug: input.homeownerSlug,
      property_slug: input.propertySlug,
      status: "generated",
      presentation: input.plan,
      draft: null,
      storage_backend: "supabase",
      generated_at: now,
      updated_at: now,
    },
    { onConflict: "homeowner_slug,property_slug" },
  );

  if (error) {
    throw new Error(`Failed to persist portal home care plan: ${error.message}`);
  }
}

interface BackfillContextRow {
  homeowner_id: string;
  homeowner_slug: string;
  homeowner_full_name: string;
  property_id: string;
  property_slug: string;
  property_name: string;
  property_address: string;
  property_city: string;
  property_state: string;
  square_feet: number | null;
  membership_plan_name: string | null;
  sales_tier: string | null;
  visit_price: number | null;
  presentation_id: string | null;
}

async function fetchBackfillContext(
  supabase: SupabaseClient,
  homeownerSlug: string,
  propertySlug: string,
): Promise<BackfillContextRow | null> {
  const { data: homeowner, error: homeownerError } = await supabase
    .from("homeowners")
    .select("id, slug, full_name")
    .eq("slug", homeownerSlug)
    .maybeSingle();

  if (homeownerError || !homeowner) return null;

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, slug, name, address, city, state, square_feet")
    .eq("homeowner_id", homeowner.id)
    .eq("slug", propertySlug)
    .maybeSingle();

  if (propertyError || !property) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("plan_name, sales_tier, visit_price, presentation_id")
    .eq("property_id", property.id)
    .maybeSingle();

  return {
    homeowner_id: homeowner.id as string,
    homeowner_slug: homeowner.slug as string,
    homeowner_full_name: homeowner.full_name as string,
    property_id: property.id as string,
    property_slug: property.slug as string,
    property_name: property.name as string,
    property_address: property.address as string,
    property_city: property.city as string,
    property_state: property.state as string,
    square_feet: (property.square_feet as number | null) ?? null,
    membership_plan_name: (membership?.plan_name as string | null) ?? null,
    sales_tier: (membership?.sales_tier as string | null) ?? null,
    visit_price: (membership?.visit_price as number | null) ?? null,
    presentation_id: (membership?.presentation_id as string | null) ?? null,
  };
}

async function buildPortalHomeCarePlanFallback(
  homeownerSlug: string,
  propertySlug: string,
): Promise<HomeCarePlanData | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPrivilegedServerSupabaseClient();
  const context = await fetchBackfillContext(
    supabase,
    homeownerSlug,
    propertySlug,
  );
  if (!context) return null;

  let plan: HomeCarePlanData | null = null;

  if (context.presentation_id) {
    const presentation = await getPresentation(context.presentation_id);
    if (presentation) {
      const tier = normalizeToSqueegeeKingTier(
        context.sales_tier ?? presentation.tier,
      );
      const visitPrice =
        context.visit_price && context.visit_price > 0
          ? context.visit_price
          : tierVisitPriceForPresentation(
              { ...presentation, tier },
              tier,
            );

      plan = buildPortalHomeCarePlanFromPresentation({
        presentation: {
          ...presentation,
          clientName: presentation.clientName || context.homeowner_full_name,
          clientAddress:
            presentation.clientAddress ||
            formatPortalPropertyAddress({
              address: context.property_address,
              city: context.property_city,
              state: context.property_state,
            }),
          homeSqft: presentation.homeSqft || context.square_feet || 0,
        },
        homeownerSlug,
        propertySlug,
        planName: context.membership_plan_name ?? presentation.tier,
        agreementTier: tier,
        visitPrice,
      });
    }
  }

  if (!plan) {
    const tier = normalizeToSqueegeeKingTier(context.sales_tier ?? "quarterly");
    const visitPrice =
      context.visit_price && context.visit_price > 0
        ? context.visit_price
        : SQUEEGEEKING_TIERS[tier].defaultVisitPrice;
    const syntheticPresentation: PresentationData = {
      id: context.presentation_id ?? `backfill-${context.property_id}`,
      createdBy: "System",
      clientName: context.homeowner_full_name,
      clientAddress: formatPortalPropertyAddress({
        address: context.property_address,
        city: context.property_city,
        state: context.property_state,
      }),
      clientEmail: "",
      homeSqft: context.square_feet ?? 0,
      twoStory: false,
      includeScreens: false,
      tier,
      monthlyRate: visitPrice,
      annualRate: visitPrice * (tier === "quarterly" ? 4 : 2),
      retailValue: 0,
      enrollmentSavings: defaultEnrollmentSavingsForTier(tier),
      customNotes: "",
      quoteSnapshot: null,
      slideOverrides: {},
      status: "signed",
      signedAt: null,
      agreementId: null,
      homeownerId: context.homeowner_id,
      propertyId: context.property_id,
      membershipId: null,
      onboardingStatus: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    plan = buildPortalHomeCarePlanFromPresentation({
      presentation: syntheticPresentation,
      homeownerSlug,
      propertySlug,
      planName: context.membership_plan_name ?? squeegeeKingTierLabel(tier),
      agreementTier: tier,
      visitPrice,
    });
  }

  return plan;
}

/**
 * Loads portal plan data without mutating customer state. Legacy members that
 * predate persisted plans receive an honest in-memory fallback; activation and
 * explicit recovery workflows remain responsible for persistence.
 */
export async function loadPortalHomeCarePlan(
  homeownerSlug: string,
  propertySlug: string,
): Promise<HomeCarePlanData | null> {
  const existing = await loadGeneratedHomeCarePlan(homeownerSlug, propertySlug);
  if (existing) return existing;

  if (!isCloudPersistenceConnected()) return null;

  return buildPortalHomeCarePlanFallback(homeownerSlug, propertySlug);
}

/** Test helper — verifies persisted record round-trips. */
export function portalPlanFromPresentationRecord(
  plan: HomeCarePlanData,
): HomeCarePlanData {
  const record = createHomeCarePlanRecord(plan, null);
  record.storageBackend = "supabase";
  return presentationFromRecord({
    ...record,
    id: `hcp_${record.homeownerSlug}_${record.propertySlug}`,
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
