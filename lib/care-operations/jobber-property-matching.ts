import "server-only";

import { isMembershipActive } from "@/lib/membership/membership-status";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  listJobberVisitReviewSample,
  type JobberVisitProjectionPreview,
} from "./jobber-visit-sample";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";

const MAX_ACTIVE_MEMBER_CANDIDATES = 250;
const MAX_VISIT_REVIEW_ROWS = 100;
const LINK_REASON =
  "Headquarters confirmed the same physical property in Jobber and HomeAtlas";
const REVOKE_REASON =
  "Headquarters revoked the supervised Jobber property link";

type PropertyClassification =
  | "jobber_only"
  | "homeatlas_member_property"
  | "link_attention";

interface MembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  status: string;
  payment_setup_completed_at: string | null;
  stripe_payment_method_id: string | null;
  stripe_customer_id: string | null;
  agreement_id: string | null;
  sales_tier: string | null;
  visit_price: number | null;
}

interface PropertyRow {
  id: string;
  homeowner_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface HomeownerRow {
  id: string;
  full_name: string;
}

interface LinkRow {
  id: string;
  external_property_id: string;
  property_id: string;
  membership_id: string;
  link_state: "active" | "revoked";
  updated_at: string;
}

interface ProjectionIdentityRow {
  id: string;
  connection_id: string;
  external_property_id: string;
}

export interface ActiveMemberPropertyCandidate {
  membershipId: string;
  propertyId: string;
  homeownerName: string;
  propertyLabel: string;
}

export interface JobberPropertyLinkPreview {
  linkId: string;
  membershipId: string;
  propertyId: string;
  homeownerName: string;
  propertyLabel: string;
  membershipActive: boolean;
  linkState: "active" | "revoked";
  updatedAt: string;
}

export interface SupervisedJobberVisitPreview
  extends JobberVisitProjectionPreview {
  propertyClassification: PropertyClassification;
  propertyLink: JobberPropertyLinkPreview | null;
  visitAuthority: "manual_review";
  billingEligible: false;
}

export interface JobberPropertyMatchingWorkspace {
  executionMode: "supervised_property_classification";
  defaultClassification: "jobber_only";
  automaticMatching: false;
  obligationMatching: false;
  billingEnabled: false;
  candidateLimitReached: boolean;
  visitLimitReached: boolean;
  activeMemberProperties: ActiveMemberPropertyCandidate[];
  visits: SupervisedJobberVisitPreview[];
}

export class SupervisedPropertyMatchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SupervisedPropertyMatchError";
  }
}

function formatPropertyLabel(property: PropertyRow): string {
  return [
    property.name,
    property.address,
    property.city,
    property.state,
    property.zip,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function isEligibleMemberProperty(
  membership: MembershipRow,
  property: Pick<PropertyRow, "id" | "homeowner_id">,
): boolean {
  return Boolean(
    membership.property_id === property.id &&
      membership.homeowner_id === property.homeowner_id &&
      isMembershipActive(membership),
  );
}

export function classifyJobberProperty(
  linkState: "active" | "revoked" | null,
  membershipActive: boolean,
): PropertyClassification {
  if (linkState !== "active") return "jobber_only";
  return membershipActive
    ? "homeatlas_member_property"
    : "link_attention";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function loadProjectionIdentity(
  projectionId: string,
): Promise<ProjectionIdentityRow> {
  if (!isUuid(projectionId)) {
    throw new SupervisedPropertyMatchError("Invalid Jobber visit record.", 400);
  }
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("jobber_visit_projections")
    .select("id, connection_id, external_property_id")
    .eq("id", projectionId)
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new SupervisedPropertyMatchError(
      "The Jobber visit record could not be found.",
      404,
    );
  }
  return data as ProjectionIdentityRow;
}

async function loadStrictMemberProperty(
  membershipId: string,
): Promise<{ membership: MembershipRow; property: PropertyRow }> {
  if (!isUuid(membershipId)) {
    throw new SupervisedPropertyMatchError("Select a valid membership.", 400);
  }
  const supabase = createServiceRoleSupabaseClient();
  const membershipResult = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, status, payment_setup_completed_at, stripe_payment_method_id, stripe_customer_id, agreement_id, sales_tier, visit_price",
    )
    .eq("id", membershipId)
    .maybeSingle();
  if (membershipResult.error) throw membershipResult.error;
  if (!membershipResult.data) {
    throw new SupervisedPropertyMatchError("Membership not found.", 404);
  }
  const membership = membershipResult.data as MembershipRow;
  const propertyResult = await supabase
    .from("properties")
    .select("id, homeowner_id, name, address, city, state, zip")
    .eq("id", membership.property_id)
    .maybeSingle();
  if (propertyResult.error) throw propertyResult.error;
  if (!propertyResult.data) {
    throw new SupervisedPropertyMatchError(
      "The membership property could not be found.",
      409,
    );
  }
  const property = propertyResult.data as PropertyRow;
  if (!isEligibleMemberProperty(membership, property)) {
    throw new SupervisedPropertyMatchError(
      "Only a strictly active membership at this exact property may be linked.",
      409,
    );
  }
  return { membership, property };
}

export async function loadJobberPropertyMatchingWorkspace(): Promise<JobberPropertyMatchingWorkspace> {
  const supabase = createServiceRoleSupabaseClient();
  const observedVisits = await listJobberVisitReviewSample(
    MAX_VISIT_REVIEW_ROWS + 1,
  );
  const visitLimitReached = observedVisits.length > MAX_VISIT_REVIEW_ROWS;
  const visits = observedVisits.slice(0, MAX_VISIT_REVIEW_ROWS);
  const externalPropertyIds = [
    ...new Set(visits.map((visit) => visit.externalPropertyId)),
  ];

  const linksResult = externalPropertyIds.length
    ? await supabase
        .from("jobber_property_links")
        .select(
          "id, external_property_id, property_id, membership_id, link_state, updated_at",
        )
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .in("external_property_id", externalPropertyIds)
    : { data: [], error: null };
  if (linksResult.error) throw linksResult.error;
  const links = (linksResult.data ?? []) as LinkRow[];

  const activeMembershipResult = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, status, payment_setup_completed_at, stripe_payment_method_id, stripe_customer_id, agreement_id, sales_tier, visit_price",
    )
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(MAX_ACTIVE_MEMBER_CANDIDATES + 1);
  if (activeMembershipResult.error) throw activeMembershipResult.error;
  const activeMembershipRows = (activeMembershipResult.data ??
    []) as MembershipRow[];
  const candidateLimitReached =
    activeMembershipRows.length > MAX_ACTIVE_MEMBER_CANDIDATES;
  const boundedActiveMemberships = activeMembershipRows.slice(
    0,
    MAX_ACTIVE_MEMBER_CANDIDATES,
  );

  const linkedMembershipIds = [...new Set(links.map((link) => link.membership_id))];
  const candidateMembershipIds = new Set(
    boundedActiveMemberships.map((membership) => membership.id),
  );
  const missingLinkedMembershipIds = linkedMembershipIds.filter(
    (id) => !candidateMembershipIds.has(id),
  );
  const linkedMembershipResult = missingLinkedMembershipIds.length
    ? await supabase
        .from("memberships")
        .select(
          "id, homeowner_id, property_id, status, payment_setup_completed_at, stripe_payment_method_id, stripe_customer_id, agreement_id, sales_tier, visit_price",
        )
        .in("id", missingLinkedMembershipIds)
    : { data: [], error: null };
  if (linkedMembershipResult.error) throw linkedMembershipResult.error;

  const memberships = [
    ...boundedActiveMemberships,
    ...((linkedMembershipResult.data ?? []) as MembershipRow[]),
  ];
  const propertyIds = [...new Set(memberships.map((row) => row.property_id))];
  const homeownerIds = [...new Set(memberships.map((row) => row.homeowner_id))];

  const [propertiesResult, homeownersResult] = await Promise.all([
    propertyIds.length
      ? supabase
          .from("properties")
          .select("id, homeowner_id, name, address, city, state, zip")
          .in("id", propertyIds)
      : Promise.resolve({ data: [], error: null }),
    homeownerIds.length
      ? supabase
          .from("homeowners")
          .select("id, full_name")
          .in("id", homeownerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (propertiesResult.error) throw propertiesResult.error;
  if (homeownersResult.error) throw homeownersResult.error;

  const propertyById = new Map(
    ((propertiesResult.data ?? []) as PropertyRow[]).map((row) => [row.id, row]),
  );
  const homeownerById = new Map(
    ((homeownersResult.data ?? []) as HomeownerRow[]).map((row) => [row.id, row]),
  );
  const membershipById = new Map(memberships.map((row) => [row.id, row]));
  const linkByExternalPropertyId = new Map(
    links.map((row) => [row.external_property_id, row]),
  );

  const activeMemberProperties = boundedActiveMemberships
    .flatMap((membership): ActiveMemberPropertyCandidate[] => {
      const property = propertyById.get(membership.property_id);
      const homeowner = homeownerById.get(membership.homeowner_id);
      if (!property || !homeowner || !isEligibleMemberProperty(membership, property)) {
        return [];
      }
      return [
        {
          membershipId: membership.id,
          propertyId: property.id,
          homeownerName: homeowner.full_name,
          propertyLabel: formatPropertyLabel(property),
        },
      ];
    })
    .sort((a, b) => a.homeownerName.localeCompare(b.homeownerName));

  return {
    executionMode: "supervised_property_classification",
    defaultClassification: "jobber_only",
    automaticMatching: false,
    obligationMatching: false,
    billingEnabled: false,
    candidateLimitReached,
    visitLimitReached,
    activeMemberProperties,
    visits: visits.map((visit) => {
      const link = linkByExternalPropertyId.get(visit.externalPropertyId) ?? null;
      const membership = link ? membershipById.get(link.membership_id) : null;
      const property = link ? propertyById.get(link.property_id) : null;
      const homeowner = membership
        ? homeownerById.get(membership.homeowner_id)
        : null;
      const membershipActive = Boolean(
        membership && property && isEligibleMemberProperty(membership, property),
      );
      return {
        ...visit,
        propertyClassification: classifyJobberProperty(
          link?.link_state ?? null,
          membershipActive,
        ),
        propertyLink:
          link && membership && property && homeowner
            ? {
                linkId: link.id,
                membershipId: membership.id,
                propertyId: property.id,
                homeownerName: homeowner.full_name,
                propertyLabel: formatPropertyLabel(property),
                membershipActive,
                linkState: link.link_state,
                updatedAt: link.updated_at,
              }
            : null,
        visitAuthority: "manual_review",
        billingEligible: false,
      };
    }),
  };
}

export async function linkJobberProperty(input: {
  projectionId: string;
  membershipId: string;
  actorId: string;
  samePhysicalPropertyConfirmed: boolean;
  expectedLinkUpdatedAt?: string | null;
}): Promise<"linked" | "already_linked"> {
  if (input.samePhysicalPropertyConfirmed !== true) {
    throw new SupervisedPropertyMatchError(
      "Confirm that Jobber and HomeAtlas show the same physical property.",
      400,
    );
  }
  const projection = await loadProjectionIdentity(input.projectionId);
  const { membership } = await loadStrictMemberProperty(input.membershipId);
  const supabase = createServiceRoleSupabaseClient();

  const existingResult = await supabase
    .from("jobber_property_links")
    .select(
      "id, external_property_id, property_id, membership_id, link_state, updated_at",
    )
    .eq("connection_id", projection.connection_id)
    .eq("external_property_id", projection.external_property_id)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = (existingResult.data as LinkRow | null) ?? null;

  if (existing?.link_state === "active") {
    if (
      existing.membership_id === membership.id &&
      existing.property_id === membership.property_id
    ) {
      return "already_linked";
    }
    throw new SupervisedPropertyMatchError(
      "This Jobber property already has an active HomeAtlas link. Revoke it before choosing another property.",
      409,
    );
  }

  const propertyConflictResult = await supabase
    .from("jobber_property_links")
    .select("id")
    .eq("connection_id", projection.connection_id)
    .eq("property_id", membership.property_id)
    .eq("link_state", "active")
    .maybeSingle();
  if (propertyConflictResult.error) throw propertyConflictResult.error;
  if (propertyConflictResult.data) {
    throw new SupervisedPropertyMatchError(
      "That HomeAtlas property is already linked to a different Jobber property.",
      409,
    );
  }

  const now = new Date().toISOString();
  if (!existing) {
    const { error } = await supabase.from("jobber_property_links").insert({
      connection_id: projection.connection_id,
      external_property_id: projection.external_property_id,
      property_id: membership.property_id,
      membership_id: membership.id,
      link_state: "active",
      linked_by: input.actorId,
      link_reason: LINK_REASON,
      linked_at: now,
    });
    if (error) throw error;
    return "linked";
  }

  if (!input.expectedLinkUpdatedAt || input.expectedLinkUpdatedAt !== existing.updated_at) {
    throw new SupervisedPropertyMatchError(
      "The property link changed while you were reviewing it. Refresh and try again.",
      409,
    );
  }
  const updateResult = await supabase
    .from("jobber_property_links")
    .update({
      property_id: membership.property_id,
      membership_id: membership.id,
      link_state: "active",
      linked_by: input.actorId,
      link_reason: LINK_REASON,
      linked_at: now,
      revoked_by: null,
      revoke_reason: null,
      revoked_at: null,
    })
    .eq("id", existing.id)
    .eq("updated_at", input.expectedLinkUpdatedAt)
    .select("id")
    .maybeSingle();
  if (updateResult.error) throw updateResult.error;
  if (!updateResult.data) {
    throw new SupervisedPropertyMatchError(
      "The property link changed while you were reviewing it. Refresh and try again.",
      409,
    );
  }
  return "linked";
}

export async function revokeJobberPropertyLink(input: {
  projectionId: string;
  actorId: string;
  expectedLinkUpdatedAt: string;
}): Promise<"revoked" | "already_jobber_only"> {
  const projection = await loadProjectionIdentity(input.projectionId);
  const supabase = createServiceRoleSupabaseClient();
  const existingResult = await supabase
    .from("jobber_property_links")
    .select(
      "id, external_property_id, property_id, membership_id, link_state, updated_at",
    )
    .eq("connection_id", projection.connection_id)
    .eq("external_property_id", projection.external_property_id)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = (existingResult.data as LinkRow | null) ?? null;
  if (!existing || existing.link_state === "revoked") {
    return "already_jobber_only";
  }
  if (!input.expectedLinkUpdatedAt || input.expectedLinkUpdatedAt !== existing.updated_at) {
    throw new SupervisedPropertyMatchError(
      "The property link changed while you were reviewing it. Refresh and try again.",
      409,
    );
  }
  const updateResult = await supabase
    .from("jobber_property_links")
    .update({
      link_state: "revoked",
      revoked_by: input.actorId,
      revoke_reason: REVOKE_REASON,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .eq("updated_at", input.expectedLinkUpdatedAt)
    .select("id")
    .maybeSingle();
  if (updateResult.error) throw updateResult.error;
  if (!updateResult.data) {
    throw new SupervisedPropertyMatchError(
      "The property link changed while you were reviewing it. Refresh and try again.",
      409,
    );
  }
  return "revoked";
}
