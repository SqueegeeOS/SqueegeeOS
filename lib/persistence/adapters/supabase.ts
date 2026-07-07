import type {
  PersistedHomeCarePlan,
  PersistedHomeCarePlanInput,
  PersistedHomeowner,
  PersistedHomeownerInput,
  PersistedMembership,
  PersistedMembershipInput,
  PersistedPhotoDocument,
  PersistedPhotoDocumentInput,
  PersistedProperty,
  PersistedPropertyInput,
  PersistedSignedAgreement,
  PersistedSignedAgreementInput,
} from "../types";
import type { PersistenceAdapter } from "../adapters/types";
import { finalizeHomeCarePlanRecord } from "../mappers/home-care-plan";
import { createBrowserSupabaseClient } from "../supabase/client";
import {
  homeCarePlanFromRow,
  homeownerFromRow,
  membershipFromRow,
  propertyAssetFromRow,
  propertyFromRow,
  signedAgreementFromRow,
  type HomeCarePlanRow,
  type HomeownerRow,
  type PropertyRow,
  type SignedAgreementRow,
} from "../supabase/mappers";

function getClient() {
  return createBrowserSupabaseClient();
}

export const supabaseAdapter: PersistenceAdapter = {
  backend: "supabase",
  isCloudConnected: true,

  async saveHomeCarePlan(
    input: PersistedHomeCarePlanInput,
  ): Promise<PersistedHomeCarePlan> {
    const supabase = getClient();
    const record = finalizeHomeCarePlanRecord(
      { ...input, storageBackend: "supabase" },
      input.id,
    );

    const { data, error } = await supabase
      .from("home_care_plans")
      .upsert(
        {
          homeowner_id: record.homeownerId,
          property_id: record.propertyId,
          homeowner_slug: record.homeownerSlug,
          property_slug: record.propertySlug,
          status: record.status,
          presentation: record.presentation,
          draft: record.draft,
          storage_backend: "supabase",
          generated_at: record.generatedAt,
          updated_at: record.updatedAt,
        },
        { onConflict: "homeowner_slug,property_slug" },
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to save home care plan: ${error.message}`);
    }

    return homeCarePlanFromRow(data as HomeCarePlanRow);
  },

  async getHomeCarePlanBySlugs(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedHomeCarePlan | null> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("home_care_plans")
      .select("*")
      .eq("homeowner_slug", homeownerSlug)
      .eq("property_slug", propertySlug)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load home care plan: ${error.message}`);
    }

    return data ? homeCarePlanFromRow(data as HomeCarePlanRow) : null;
  },

  async listHomeCarePlans(): Promise<PersistedHomeCarePlan[]> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("home_care_plans")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list home care plans: ${error.message}`);
    }

    return (data as HomeCarePlanRow[]).map(homeCarePlanFromRow);
  },

  async deleteHomeCarePlan(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<void> {
    const supabase = getClient();

    const { error } = await supabase
      .from("home_care_plans")
      .delete()
      .eq("homeowner_slug", homeownerSlug)
      .eq("property_slug", propertySlug);

    if (error) {
      throw new Error(`Failed to delete home care plan: ${error.message}`);
    }
  },

  async upsertHomeowner(
    input: PersistedHomeownerInput,
  ): Promise<PersistedHomeowner> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("homeowners")
      .upsert(
        {
          slug: input.slug,
          full_name: input.fullName,
          first_name: input.firstName,
          email: input.email,
          phone: input.phone,
        },
        { onConflict: "slug" },
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to upsert homeowner: ${error.message}`);
    }

    return homeownerFromRow(data as HomeownerRow);
  },

  async getHomeownerBySlug(slug: string): Promise<PersistedHomeowner | null> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("homeowners")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load homeowner: ${error.message}`);
    }

    return data ? homeownerFromRow(data as HomeownerRow) : null;
  },

  async upsertProperty(
    input: PersistedPropertyInput,
  ): Promise<PersistedProperty> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("properties")
      .upsert(
        {
          homeowner_id: input.homeownerId,
          slug: input.slug,
          name: input.name,
          address: input.address,
          city: input.city,
          state: input.state,
          zip: input.zip,
          type: input.type,
          hero_image: input.heroImage,
          home_care_score: input.homeCareScore,
          health_status: input.healthStatus,
          year_built: input.yearBuilt,
          square_feet: input.squareFeet,
          narrative: input.narrative,
          last_visit: input.lastVisit,
        },
        { onConflict: "homeowner_id,slug" },
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to upsert property: ${error.message}`);
    }

    return propertyFromRow(data as PropertyRow);
  },

  async getPropertyBySlug(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedProperty | null> {
    const homeowner = await supabaseAdapter.getHomeownerBySlug(homeownerSlug);
    if (!homeowner) return null;

    const supabase = getClient();
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("homeowner_id", homeowner.id)
      .eq("slug", propertySlug)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load property: ${error.message}`);
    }

    return data ? propertyFromRow(data as PropertyRow) : null;
  },

  async saveMembership(
    input: PersistedMembershipInput,
  ): Promise<PersistedMembership> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("memberships")
      .upsert(
        {
          homeowner_id: input.homeownerId,
          property_id: input.propertyId,
          home_care_plan_id: input.homeCarePlanId,
          presentation_id: input.presentationId,
          agreement_id: input.agreementId,
          plan_id: input.planId,
          plan_name: input.planName,
          price_display: input.priceDisplay,
          billing_period: input.billingPeriod,
          sales_tier: input.salesTier,
          visit_price: input.visitPrice,
          annual_rate: input.annualRate,
          visits_per_year: input.visitsPerYear,
          billing_schedule: input.billingSchedule,
          next_billing_date: input.nextBillingDate,
          payment_setup_completed_at: input.paymentSetupCompletedAt,
          status: input.status,
          stripe_customer_id: input.stripeCustomerId,
          stripe_payment_method_id: input.stripePaymentMethodId,
          stripe_subscription_id: input.stripeSubscriptionId,
          stripe_price_id: input.stripePriceId,
          started_at: input.startedAt,
          founding_member: input.foundingMember,
          founding_member_since: input.foundingMemberSince,
          cancelled_at: input.cancelledAt,
        },
        { onConflict: "property_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to save membership: ${error.message}`);
    }

    return membershipFromRow(data);
  },

  async getMembershipByProperty(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedMembership | null> {
    const property = await supabaseAdapter.getPropertyBySlug(
      homeownerSlug,
      propertySlug,
    );
    if (!property) return null;

    const supabase = getClient();
    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .eq("property_id", property.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load membership: ${error.message}`);
    }

    return data ? membershipFromRow(data) : null;
  },

  async saveSignedAgreement(
    input: PersistedSignedAgreementInput,
  ): Promise<PersistedSignedAgreement> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("signed_agreements")
      .insert({
        homeowner_id: input.homeownerId,
        property_id: input.propertyId,
        membership_id: input.membershipId,
        presentation_id: input.presentationId,
        homeowner_slug: input.homeownerSlug,
        property_slug: input.propertySlug,
        homeowner_name: input.homeownerName,
        plan_id: input.planId,
        plan_name: input.planName,
        signature_method: input.signature.method,
        signer_name: input.signature.signerName,
        signature_image_url: input.signature.signatureImageUrl,
        typed_text: input.signature.typedText,
        signed_at: input.metadata.signedAt,
        ip_address: input.metadata.ipAddress,
        user_agent: input.metadata.userAgent,
        client_session_id: input.metadata.clientSessionId,
        agreement_pdf_url: input.agreementPdfUrl,
        signature_image_storage_path: input.signatureImageStoragePath,
        status: input.status,
        storage_backend: "supabase",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to save signed agreement: ${error.message}`);
    }

    return signedAgreementFromRow(data as SignedAgreementRow);
  },

  async listSignedAgreementsByProperty(
    homeownerSlug: string,
    propertySlug: string,
  ): Promise<PersistedSignedAgreement[]> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("signed_agreements")
      .select("*")
      .eq("homeowner_slug", homeownerSlug)
      .eq("property_slug", propertySlug)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list signed agreements: ${error.message}`);
    }

    return (data as SignedAgreementRow[]).map(signedAgreementFromRow);
  },

  async savePhotoDocument(
    input: PersistedPhotoDocumentInput,
  ): Promise<PersistedPhotoDocument> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("property_assets")
      .insert({
        property_id: input.propertyId,
        homeowner_id: input.homeownerId,
        kind: input.kind,
        category: input.category,
        title: input.title,
        description: input.description,
        storage_path: input.storagePath,
        mime_type: input.mimeType,
        file_size_bytes: input.fileSizeBytes,
        visit_id: input.visitId,
        signed_agreement_id: input.signedAgreementId,
        photo_source: input.photoSource ?? null,
        is_primary: input.isPrimary ?? false,
        external_url: input.externalUrl ?? null,
        captured_at: input.capturedAt,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to save property asset: ${error.message}`);
    }

    return propertyAssetFromRow(data);
  },

  async listPhotoDocumentsByProperty(
    propertyId: string,
  ): Promise<PersistedPhotoDocument[]> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("property_assets")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list property assets: ${error.message}`);
    }

    return data.map(propertyAssetFromRow);
  },
};
