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
import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import type { PortalAccessContext } from "@/lib/persistence/queries/portal-access";
import { getPresentationForPortalAccess } from "@/lib/presentations/repository";
import { tierVisitPriceForPresentation } from "@/lib/presentations/calculations";
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
      yearBuilt: null,
      homeCareScore: null,
      lastVisit: null,
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
  access: PortalAccessContext,
): Promise<BackfillContextRow | null> {
  const { data: homeowner, error: homeownerError } = await supabase
    .from("homeowners")
    .select("id, slug, full_name")
    .eq("id", access.homeownerId)
    .eq("slug", access.homeownerSlug)
    .maybeSingle();

  if (
    homeownerError ||
    !homeowner ||
    homeowner.id !== access.homeownerId ||
    homeowner.slug !== access.homeownerSlug
  ) {
    return null;
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, homeowner_id, slug, name, address, city, state, square_feet")
    .eq("id", access.propertyId)
    .eq("homeowner_id", access.homeownerId)
    .eq("slug", access.propertySlug)
    .maybeSingle();

  if (
    propertyError ||
    !property ||
    property.id !== access.propertyId ||
    property.homeowner_id !== access.homeownerId ||
    property.slug !== access.propertySlug
  ) {
    return null;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, plan_name, sales_tier, visit_price, presentation_id",
    )
    .eq("id", access.membershipId)
    .eq("homeowner_id", access.homeownerId)
    .eq("property_id", access.propertyId)
    .maybeSingle();

  if (
    membershipError ||
    !membership ||
    membership.id !== access.membershipId ||
    membership.homeowner_id !== access.homeownerId ||
    membership.property_id !== access.propertyId
  ) {
    return null;
  }

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

async function backfillPortalHomeCarePlan(
  supabase: SupabaseClient,
  access: PortalAccessContext,
): Promise<HomeCarePlanData | null> {
  const context = await fetchBackfillContext(supabase, access);
  if (!context) return null;

  const { homeownerSlug, propertySlug } = access;

  let plan: HomeCarePlanData | null = null;

  if (context.presentation_id) {
    const presentation = await getPresentationForPortalAccess(
      context.presentation_id,
      access,
    );
    if (!presentation) return null;

    const tier = normalizeToSqueegeeKingTier(
      context.sales_tier ?? presentation.tier,
    );
    const visitPrice =
      context.visit_price && context.visit_price > 0
        ? context.visit_price
        : tierVisitPriceForPresentation({ ...presentation, tier }, tier);

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

  return persistMissingPortalHomeCarePlanWithoutReplacement(
    supabase,
    access,
    plan,
  );
}

type AuthorizedPortalPlanLookup =
  | { kind: "missing" }
  | { kind: "blocked" }
  | { kind: "found"; plan: HomeCarePlanData };

async function loadExistingAuthorizedPortalPlan(
  supabase: SupabaseClient,
  access: PortalAccessContext,
): Promise<AuthorizedPortalPlanLookup> {
  const { data, error } = await supabase
    .from("home_care_plans")
    .select("status, presentation, homeowner_slug, property_slug")
    .eq("homeowner_id", access.homeownerId)
    .eq("property_id", access.propertyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load portal Home Care Plan: ${error.message}`);
  }
  if (!data) return { kind: "missing" };

  const presentation = data.presentation as HomeCarePlanData | null;
  if (
    !presentation ||
    !["generated", "published"].includes(data.status as string) ||
    data.homeowner_slug !== access.homeownerSlug ||
    data.property_slug !== access.propertySlug ||
    presentation.homeowner?.slug !== access.homeownerSlug ||
    presentation.property?.slug !== access.propertySlug
  ) {
    return { kind: "blocked" };
  }

  return { kind: "found", plan: presentation };
}

async function persistMissingPortalHomeCarePlanWithoutReplacement(
  supabase: SupabaseClient,
  access: PortalAccessContext,
  plan: HomeCarePlanData,
): Promise<HomeCarePlanData | null> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("home_care_plans").upsert(
    {
      homeowner_id: access.homeownerId,
      property_id: access.propertyId,
      homeowner_slug: access.homeownerSlug,
      property_slug: access.propertySlug,
      status: "generated",
      presentation: plan,
      draft: null,
      storage_backend: "supabase",
      generated_at: now,
      updated_at: now,
    },
    {
      onConflict: "homeowner_slug,property_slug",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    throw new Error(`Failed to backfill portal Home Care Plan: ${error.message}`);
  }

  const persisted = await loadExistingAuthorizedPortalPlan(supabase, access);
  return persisted.kind === "found" ? persisted.plan : null;
}

/** Loads portal plan data only after a portal token resolves to this member. */
export async function loadPortalHomeCarePlan(
  access: PortalAccessContext,
): Promise<HomeCarePlanData | null> {
  if (!isCloudPersistenceConnected()) return null;

  const supabase = createPrivilegedServerSupabaseClient();
  const existing = await loadExistingAuthorizedPortalPlan(supabase, access);
  if (existing.kind === "found") return existing.plan;
  if (existing.kind === "blocked") return null;

  return backfillPortalHomeCarePlan(supabase, access);
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
