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
import { createBrowserSupabaseClient } from "../supabase/client";
import {
  homeownerFromRow,
  membershipFromRow,
  propertyAssetFromRow,
  propertyFromRow,
  signedAgreementFromRow,
  type HomeownerRow,
  type PropertyRow,
  type SignedAgreementRow,
} from "../supabase/mappers";

function getClient() {
  return createBrowserSupabaseClient();
}

function browserMutationBlocked(): never {
  throw new Error(
    "Browser Supabase mutation authority is closed; use the narrow server domain route.",
  );
}

function browserPlanReadBlocked(): never {
  throw new Error(
    "Browser Supabase Home Care Plan reads are closed; use the narrow server presentation loader.",
  );
}

export const supabaseAdapter: PersistenceAdapter = {
  backend: "supabase",
  isCloudConnected: true,

  async saveHomeCarePlan(
    _input: PersistedHomeCarePlanInput,
  ): Promise<PersistedHomeCarePlan> {
    void _input;
    return browserMutationBlocked();
  },

  async getHomeCarePlanBySlugs(
    _homeownerSlug: string,
    _propertySlug: string,
  ): Promise<PersistedHomeCarePlan | null> {
    void _homeownerSlug;
    void _propertySlug;
    return browserPlanReadBlocked();
  },

  async listHomeCarePlans(): Promise<PersistedHomeCarePlan[]> {
    return browserPlanReadBlocked();
  },

  async deleteHomeCarePlan(
    _homeownerSlug: string,
    _propertySlug: string,
  ): Promise<void> {
    void _homeownerSlug;
    void _propertySlug;
    browserMutationBlocked();
  },

  async upsertHomeowner(
    _input: PersistedHomeownerInput,
  ): Promise<PersistedHomeowner> {
    void _input;
    return browserMutationBlocked();
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
    _input: PersistedPropertyInput,
  ): Promise<PersistedProperty> {
    void _input;
    return browserMutationBlocked();
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
    _input: PersistedMembershipInput,
  ): Promise<PersistedMembership> {
    void _input;
    return browserMutationBlocked();
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
    _input: PersistedSignedAgreementInput,
  ): Promise<PersistedSignedAgreement> {
    void _input;
    return browserMutationBlocked();
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
    _input: PersistedPhotoDocumentInput,
  ): Promise<PersistedPhotoDocument> {
    void _input;
    return browserMutationBlocked();
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
