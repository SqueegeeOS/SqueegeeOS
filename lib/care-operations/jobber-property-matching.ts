import "server-only";

import { isMembershipActive } from "@/lib/membership/membership-status";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  listJobberVisitReviewSample,
  type JobberVisitProjectionPreview,
} from "./jobber-visit-sample";
import {
  JobberClientProviderError,
  proveJobberClientPropertyOwnership,
  type JobberPropertyOwnershipEvidence,
} from "./jobber-client-search-provider";
import { getFreshJobberAccessToken } from "./jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";

const MAX_ACTIVE_MEMBER_CANDIDATES = 250;
const MAX_VISIT_REVIEW_ROWS = 100;
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

interface AgreementRow {
  id: string;
  membership_id: string;
  property_id: string;
  homeowner_id: string;
  status: string;
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
  external_client_id: string;
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

export interface ActiveMemberPropertyCandidatesResult {
  activeMemberProperties: ActiveMemberPropertyCandidate[];
  candidateLimitReached: boolean;
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

export function isEligibleSignedMemberProperty(
  membership: MembershipRow,
  property: Pick<PropertyRow, "id" | "homeowner_id">,
  agreement: AgreementRow | null,
): boolean {
  return Boolean(
    isEligibleMemberProperty(membership, property) &&
      agreement?.id === membership.agreement_id &&
      agreement.status === "complete" &&
      agreement.membership_id === membership.id &&
      agreement.property_id === property.id &&
      agreement.homeowner_id === property.homeowner_id,
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
    .select("id, connection_id, external_client_id, external_property_id")
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

export async function loadActiveMemberPropertyCandidates(): Promise<ActiveMemberPropertyCandidatesResult> {
  const supabase = createServiceRoleSupabaseClient();
  const membershipsResult = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, status, payment_setup_completed_at, stripe_payment_method_id, stripe_customer_id, agreement_id, sales_tier, visit_price",
    )
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(MAX_ACTIVE_MEMBER_CANDIDATES + 1);
  if (membershipsResult.error) throw membershipsResult.error;
  const membershipRows = (membershipsResult.data ?? []) as MembershipRow[];
  const candidateLimitReached =
    membershipRows.length > MAX_ACTIVE_MEMBER_CANDIDATES;
  const memberships = membershipRows.slice(0, MAX_ACTIVE_MEMBER_CANDIDATES);
  const propertyIds = [...new Set(memberships.map((row) => row.property_id))];
  const homeownerIds = [...new Set(memberships.map((row) => row.homeowner_id))];
  const agreementIds = memberships.flatMap((row) =>
    row.agreement_id ? [row.agreement_id] : [],
  );
  const [propertiesResult, homeownersResult, agreementsResult] = await Promise.all([
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
    agreementIds.length
      ? supabase
          .from("signed_agreements")
          .select("id, membership_id, property_id, homeowner_id, status")
          .in("id", agreementIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (propertiesResult.error) throw propertiesResult.error;
  if (homeownersResult.error) throw homeownersResult.error;
  if (agreementsResult.error) throw agreementsResult.error;

  const propertyById = new Map(
    ((propertiesResult.data ?? []) as PropertyRow[]).map((row) => [row.id, row]),
  );
  const homeownerById = new Map(
    ((homeownersResult.data ?? []) as HomeownerRow[]).map((row) => [row.id, row]),
  );
  const agreementById = new Map(
    ((agreementsResult.data ?? []) as AgreementRow[]).map((row) => [row.id, row]),
  );
  const activeMemberProperties = memberships
    .flatMap((membership): ActiveMemberPropertyCandidate[] => {
      const property = propertyById.get(membership.property_id);
      const homeowner = homeownerById.get(membership.homeowner_id);
      const agreement = membership.agreement_id
        ? agreementById.get(membership.agreement_id) ?? null
        : null;
      if (
        !property ||
        !homeowner ||
        !isEligibleSignedMemberProperty(membership, property, agreement)
      ) {
        return [];
      }
      return [{
        membershipId: membership.id,
        propertyId: property.id,
        homeownerName: homeowner.full_name,
        propertyLabel: formatPropertyLabel(property),
      }];
    })
    .sort((a, b) => a.homeownerName.localeCompare(b.homeownerName));

  return { activeMemberProperties, candidateLimitReached };
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
  const projection = await loadProjectionIdentity(input.projectionId);
  if (projection.connection_id !== JOBBER_CONNECTION_ID) {
    throw new SupervisedPropertyMatchError(
      "The Jobber connection does not match this property.",
      409,
    );
  }
  return linkSearchedJobberClientProperty({
    clientId: projection.external_client_id,
    externalPropertyId: projection.external_property_id,
    membershipId: input.membershipId,
    actorId: input.actorId,
    samePhysicalPropertyConfirmed: input.samePhysicalPropertyConfirmed,
  });
}

interface JobberSearchLinkRpcResult {
  outcome: "linked" | "already_linked";
  link_id: string;
}

interface JobberSearchLinkRpcClient {
  rpc(
    name: "link_jobber_member_property_from_search",
    args: {
      requested_actor_id: string;
      requested_connection_id: string;
      requested_jobber_client_id: string;
      requested_external_property_id: string;
      requested_jobber_property_web_uri: string;
      requested_graphql_version: string;
      requested_ownership_observed_at: string;
      requested_ownership_pages_scanned: number;
      requested_property_coverage_complete: boolean;
      requested_membership_id: string;
      requested_same_physical_property_confirmed: boolean;
    },
  ): PromiseLike<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
}

function assertSearchLinkRpcResult(value: unknown): JobberSearchLinkRpcResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SupervisedPropertyMatchError(
      "Property-link storage returned malformed data.",
      503,
    );
  }
  const row = value as Record<string, unknown>;
  if (
    !["linked", "already_linked"].includes(String(row.outcome)) ||
    typeof row.link_id !== "string"
  ) {
    throw new SupervisedPropertyMatchError(
      "Property-link storage returned malformed data.",
      503,
    );
  }
  return row as unknown as JobberSearchLinkRpcResult;
}

function mapSearchLinkPersistenceError(error: {
  message: string;
  code?: string;
}): never {
  if (error.message.includes("jobber_link_invalid:")) {
    throw new SupervisedPropertyMatchError(
      "Refresh the Jobber property and confirm the exact member property.",
      400,
    );
  }
  if (error.message.includes("jobber_link_forbidden:")) {
    throw new SupervisedPropertyMatchError(
      "Headquarters authorization is no longer active.",
      403,
    );
  }
  if (error.message.includes("jobber_link_not_found:")) {
    throw new SupervisedPropertyMatchError(
      "The selected membership no longer exists.",
      404,
    );
  }
  if (
    error.message.includes("jobber_link_conflict:") ||
    error.code === "23505" ||
    /duplicate key|unique constraint/i.test(error.message)
  ) {
    throw new SupervisedPropertyMatchError(
      "The Jobber property or HomeAtlas property has a conflicting active link. Refresh before trying again.",
      409,
    );
  }
  throw new SupervisedPropertyMatchError(
    "Property-link storage is unavailable.",
    503,
  );
}

export async function persistJobberMemberPropertySearchLink(
  input: {
    ownership: JobberPropertyOwnershipEvidence;
    membershipId: string;
    actorId: string;
    samePhysicalPropertyConfirmed: boolean;
  },
  client: JobberSearchLinkRpcClient =
    createServiceRoleSupabaseClient() as unknown as JobberSearchLinkRpcClient,
): Promise<"linked" | "already_linked"> {
  if (
    !isUuid(input.membershipId) ||
    !isUuid(input.actorId) ||
    input.samePhysicalPropertyConfirmed !== true ||
    input.ownership.propertyCoverageComplete !== true ||
    !input.ownership.clientId.trim() ||
    !input.ownership.externalPropertyId.trim() ||
    !input.ownership.jobberPropertyWebUri.startsWith("https://") ||
    !input.ownership.observedGraphqlVersion.trim() ||
    !Number.isFinite(Date.parse(input.ownership.observedAt)) ||
    !Number.isInteger(input.ownership.pagesScanned) ||
    input.ownership.pagesScanned < 1 ||
    input.ownership.pagesScanned > 10
  ) {
    throw new SupervisedPropertyMatchError(
      "Refresh the Jobber property and confirm the exact member property.",
      400,
    );
  }
  const { data, error } = await client.rpc(
    "link_jobber_member_property_from_search",
    {
      requested_actor_id: input.actorId,
      requested_connection_id: JOBBER_CONNECTION_ID,
      requested_jobber_client_id: input.ownership.clientId,
      requested_external_property_id: input.ownership.externalPropertyId,
      requested_jobber_property_web_uri:
        input.ownership.jobberPropertyWebUri,
      requested_graphql_version: input.ownership.observedGraphqlVersion,
      requested_ownership_observed_at: input.ownership.observedAt,
      requested_ownership_pages_scanned: input.ownership.pagesScanned,
      requested_property_coverage_complete:
        input.ownership.propertyCoverageComplete,
      requested_membership_id: input.membershipId,
      requested_same_physical_property_confirmed:
        input.samePhysicalPropertyConfirmed,
    },
  );
  if (error) mapSearchLinkPersistenceError(error);
  return assertSearchLinkRpcResult(data).outcome;
}

export async function linkSearchedJobberClientProperty(
  input: {
    clientId: string;
    externalPropertyId: string;
    membershipId: string;
    actorId: string;
    samePhysicalPropertyConfirmed: boolean;
  },
  dependencies: {
    getAccessToken?: () => Promise<string>;
    proveOwnership?: (
      accessToken: string,
      clientId: string,
      externalPropertyId: string,
    ) => Promise<JobberPropertyOwnershipEvidence>;
    persistLink?: typeof persistJobberMemberPropertySearchLink;
  } = {},
): Promise<"linked" | "already_linked"> {
  if (input.samePhysicalPropertyConfirmed !== true) {
    throw new SupervisedPropertyMatchError(
      "Confirm that Jobber and HomeAtlas show the same physical property.",
      400,
    );
  }
  const getAccessToken =
    dependencies.getAccessToken ?? getFreshJobberAccessToken;
  const proveOwnership =
    dependencies.proveOwnership ?? proveJobberClientPropertyOwnership;
  const accessToken = await getAccessToken();
  let ownership: JobberPropertyOwnershipEvidence;
  try {
    ownership = await proveOwnership(
      accessToken,
      input.clientId,
      input.externalPropertyId,
    );
  } catch (error) {
    if (
      error instanceof JobberClientProviderError &&
      (error.code === "property_coverage_incomplete" ||
        error.code === "property_not_owned")
    ) {
      throw new SupervisedPropertyMatchError(
        error.code === "property_coverage_incomplete"
          ? "Complete Jobber client-property coverage is required before linking."
          : "That Jobber property does not belong to the selected client.",
        409,
      );
    }
    throw error;
  }
  return (dependencies.persistLink ?? persistJobberMemberPropertySearchLink)({
    ownership,
    membershipId: input.membershipId,
    actorId: input.actorId,
    samePhysicalPropertyConfirmed: input.samePhysicalPropertyConfirmed,
  });
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
