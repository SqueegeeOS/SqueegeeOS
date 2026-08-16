import "server-only";

import { isMembershipActive } from "@/lib/membership/membership-status";
import { MEMBERSHIP_APPOINTMENT_TYPE } from "@/lib/membership/membership-appointment-types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  listJobberVisits,
  type JobberVisitProjectionPreview,
} from "./jobber-visit-sync";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";
import { reconcileAllPairedCustomerPortalVisits } from "./jobber-portal-appointments";

const MAX_ACTIVE_MEMBER_CANDIDATES = 250;
const LINK_ACTOR = "hq_admin";
const LINK_REASON =
  "Headquarters confirmed the same physical property in Jobber and HomeAtlas";
const REVOKE_REASON =
  "Headquarters revoked the supervised Jobber property link";
const JOB_LINK_REASON =
  "Headquarters confirmed this recurring Jobber job is the membership service";
const JOB_REVOKE_REASON =
  "Headquarters revoked the Jobber membership-service classification";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  external_job_id: string;
  title: string | null;
}

interface JobLinkRow {
  id: string;
  connection_id: string;
  external_job_id: string;
  external_property_id: string;
  membership_id: string;
  property_id: string;
  link_state: "active" | "revoked";
  updated_at: string;
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
  visitAuthority: "manual_review" | "membership_job";
  billingEligible: boolean;
  membershipJobLink: {
    linkId: string;
    membershipId: string;
    propertyId: string;
    linkState: "active" | "revoked";
    updatedAt: string;
  } | null;
  membershipJobConflict: boolean;
}

export interface JobberPropertyMatchingWorkspace {
  executionMode: "supervised_property_classification";
  defaultClassification: "jobber_only";
  automaticMatching: false;
  obligationMatching: false;
  billingEnabled: false;
  focusedMemberProperty: ActiveMemberPropertyCandidate | null;
  candidateLimitReached: boolean;
  activeMemberProperties: ActiveMemberPropertyCandidate[];
  visits: SupervisedJobberVisitPreview[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
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

export function isActiveMembershipJobLink(input: {
  jobLink: Pick<
    JobLinkRow,
    | "membership_id"
    | "property_id"
    | "external_property_id"
    | "link_state"
  > | null;
  propertyLink: Pick<
    LinkRow,
    "membership_id" | "property_id" | "link_state"
  > | null;
  externalPropertyId: string;
  membershipActive: boolean;
}): boolean {
  return Boolean(
    input.membershipActive &&
      input.jobLink?.link_state === "active" &&
      input.propertyLink?.link_state === "active" &&
      input.jobLink.membership_id === input.propertyLink.membership_id &&
      input.jobLink.property_id === input.propertyLink.property_id &&
      input.jobLink.external_property_id === input.externalPropertyId,
  );
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
    .select("id, connection_id, external_property_id, external_job_id, title")
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

async function loadFocusedMemberProperty(
  membershipId: string,
): Promise<{
  membership: MembershipRow;
  property: PropertyRow;
  candidate: ActiveMemberPropertyCandidate;
  externalPropertyId: string | null;
  externalClientId: string | null;
}> {
  const { membership, property } = await loadStrictMemberProperty(membershipId);
  const supabase = createServiceRoleSupabaseClient();
  const [homeownerResult, propertyLinkResult, customerLinkResult] =
    await Promise.all([
      supabase
        .from("homeowners")
        .select("id, full_name")
        .eq("id", membership.homeowner_id)
        .maybeSingle(),
      supabase
        .from("jobber_property_links")
        .select("external_property_id")
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .eq("membership_id", membership.id)
        .eq("property_id", property.id)
        .eq("link_state", "active")
        .maybeSingle(),
      supabase
        .from("jobber_customer_links")
        .select("external_client_id")
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .eq("homeowner_id", membership.homeowner_id)
        .eq("link_state", "active")
        .maybeSingle(),
    ]);
  if (homeownerResult.error) throw homeownerResult.error;
  if (propertyLinkResult.error) throw propertyLinkResult.error;
  if (customerLinkResult.error) throw customerLinkResult.error;
  if (!homeownerResult.data) {
    throw new SupervisedPropertyMatchError(
      "The membership homeowner could not be found.",
      409,
    );
  }
  const homeowner = homeownerResult.data as HomeownerRow;
  return {
    membership,
    property,
    candidate: {
      membershipId: membership.id,
      propertyId: property.id,
      homeownerName: homeowner.full_name,
      propertyLabel: formatPropertyLabel(property),
    },
    externalPropertyId:
      (propertyLinkResult.data?.external_property_id as string | undefined) ??
      null,
    externalClientId:
      (customerLinkResult.data?.external_client_id as string | undefined) ??
      null,
  };
}

async function revokeMembershipJobsForProperty(input: {
  connectionId: string;
  externalPropertyId: string;
  reason: string;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const activeJobLinks = await supabase
    .from("jobber_membership_job_links")
    .select("external_job_id")
    .eq("connection_id", input.connectionId)
    .eq("external_property_id", input.externalPropertyId)
    .eq("link_state", "active");
  if (activeJobLinks.error) throw activeJobLinks.error;

  const externalJobIds = [
    ...new Set(
      (activeJobLinks.data ?? []).map(
        (row) => row.external_job_id as string,
      ),
    ),
  ];
  if (externalJobIds.length === 0) return;

  const now = new Date().toISOString();
  const revokedJobs = await supabase
    .from("jobber_membership_job_links")
    .update({
      link_state: "revoked",
      revoked_by: LINK_ACTOR,
      revoke_reason: input.reason,
      revoked_at: now,
    })
    .eq("connection_id", input.connectionId)
    .eq("external_property_id", input.externalPropertyId)
    .eq("link_state", "active");
  if (revokedJobs.error) throw revokedJobs.error;

  const projectionRows = await supabase
    .from("jobber_visit_projections")
    .select("external_visit_id")
    .eq("connection_id", input.connectionId)
    .eq("external_property_id", input.externalPropertyId)
    .in("external_job_id", externalJobIds);
  if (projectionRows.error) throw projectionRows.error;
  const externalVisitIds = [
    ...new Set(
      (projectionRows.data ?? []).map(
        (row) => row.external_visit_id as string,
      ),
    ),
  ];

  const demotedProjections = await supabase
    .from("jobber_visit_projections")
    .update({
      match_state: "manual_review",
      matched_property_id: null,
      matched_obligation_id: null,
    })
    .eq("connection_id", input.connectionId)
    .eq("external_property_id", input.externalPropertyId)
    .in("external_job_id", externalJobIds);
  if (demotedProjections.error) throw demotedProjections.error;

  if (externalVisitIds.length > 0) {
    const demotedAppointments = await supabase
      .from("member_appointments")
      .update({
        status: "cancelled",
        verification_state: "unverified",
        completed_at: null,
      })
      .eq("provider", "jobber")
      .in("external_id", externalVisitIds);
    if (demotedAppointments.error) throw demotedAppointments.error;
  }
}

export async function loadJobberPropertyMatchingWorkspace(options: {
  search?: string;
  page?: number;
  pageSize?: number;
  focusMembershipId?: string | null;
  focusProjectionId?: string | null;
} = {}): Promise<JobberPropertyMatchingWorkspace> {
  const supabase = createServiceRoleSupabaseClient();
  const focusMembershipId = options.focusMembershipId?.trim() ?? "";
  const focusProjectionId = options.focusProjectionId?.trim() ?? "";
  if (focusMembershipId && focusProjectionId) {
    throw new SupervisedPropertyMatchError(
      "Choose either a member handoff or an exact Jobber visit handoff.",
      400,
    );
  }
  if (focusProjectionId && !UUID_PATTERN.test(focusProjectionId)) {
    throw new SupervisedPropertyMatchError(
      "The focused Jobber visit is invalid.",
      400,
    );
  }
  const focusedMember = focusMembershipId
    ? await loadFocusedMemberProperty(focusMembershipId)
    : null;
  const requestedSearch = focusProjectionId
    ? ""
    : (options.search?.trim().slice(0, 120) ?? "");
  const exactExternalPropertyId = focusedMember?.externalPropertyId ?? null;
  const exactExternalClientId = exactExternalPropertyId
    ? null
    : (focusedMember?.externalClientId ?? null);
  const fallbackSearch =
    exactExternalPropertyId || exactExternalClientId
      ? ""
      : (focusedMember?.candidate.homeownerName ?? "");
  const visitList = await listJobberVisits({
    search: requestedSearch || fallbackSearch,
    page: options.page,
    pageSize: options.pageSize,
    projectionId: focusProjectionId,
    externalPropertyId: exactExternalPropertyId,
    externalClientId: exactExternalClientId,
  });
  const visits = visitList.visits;
  const externalPropertyIds = [
    ...new Set(visits.map((visit) => visit.externalPropertyId)),
  ];
  const externalJobIds = [...new Set(visits.map((visit) => visit.externalJobId))];
  const linksPromise = externalPropertyIds.length
    ? supabase
        .from("jobber_property_links")
        .select(
          "id, external_property_id, property_id, membership_id, link_state, updated_at",
        )
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .in("external_property_id", externalPropertyIds)
    : Promise.resolve({ data: [], error: null });
  const jobLinksPromise = externalJobIds.length
    ? supabase
        .from("jobber_membership_job_links")
        .select(
          "id, connection_id, external_job_id, external_property_id, membership_id, property_id, link_state, updated_at",
        )
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .in("external_job_id", externalJobIds)
    : Promise.resolve({ data: [], error: null });
  const activeMembershipPromise = focusedMember
    ? { data: [focusedMember.membership], error: null }
    : supabase
        .from("memberships")
        .select(
          "id, homeowner_id, property_id, status, payment_setup_completed_at, stripe_payment_method_id, stripe_customer_id, agreement_id, sales_tier, visit_price",
        )
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(MAX_ACTIVE_MEMBER_CANDIDATES + 1);
  const [linksResult, jobLinksResult, activeMembershipResult] =
    await Promise.all([
      linksPromise,
      jobLinksPromise,
      activeMembershipPromise,
    ]);
  if (linksResult.error) throw linksResult.error;
  if (jobLinksResult.error) throw jobLinksResult.error;
  if (activeMembershipResult.error) throw activeMembershipResult.error;
  const links = (linksResult.data ?? []) as LinkRow[];
  const jobLinks = (jobLinksResult.data ?? []) as JobLinkRow[];
  const activeMembershipRows = (activeMembershipResult.data ??
    []) as MembershipRow[];
  const candidateLimitReached = focusedMember
    ? false
    : activeMembershipRows.length > MAX_ACTIVE_MEMBER_CANDIDATES;
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
  const jobLinkByExternalJobId = new Map(
    jobLinks.map((row) => [row.external_job_id, row]),
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
    focusedMemberProperty: focusedMember?.candidate ?? null,
    candidateLimitReached,
    activeMemberProperties,
    total: visitList.total,
    page: visitList.page,
    pageSize: visitList.pageSize,
    totalPages: visitList.totalPages,
    search: visitList.search,
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
      const membershipJobLink =
        jobLinkByExternalJobId.get(visit.externalJobId) ?? null;
      const jobLinkActive = isActiveMembershipJobLink({
        jobLink: membershipJobLink,
        propertyLink: link,
        externalPropertyId: visit.externalPropertyId,
        membershipActive,
      });
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
        visitAuthority: jobLinkActive ? "membership_job" : "manual_review",
        billingEligible: jobLinkActive,
        membershipJobLink: membershipJobLink
          ? {
              linkId: membershipJobLink.id,
              membershipId: membershipJobLink.membership_id,
              propertyId: membershipJobLink.property_id,
              linkState: membershipJobLink.link_state,
              updatedAt: membershipJobLink.updated_at,
            }
          : null,
        membershipJobConflict: Boolean(
          membershipJobLink?.link_state === "active" && !jobLinkActive,
        ),
      };
    }),
  };
}

export async function linkJobberProperty(input: {
  projectionId: string;
  membershipId: string;
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
  if (
    existing &&
    (!input.expectedLinkUpdatedAt ||
      input.expectedLinkUpdatedAt !== existing.updated_at)
  ) {
    throw new SupervisedPropertyMatchError(
      "The property link changed while you were reviewing it. Refresh and try again.",
      409,
    );
  }

  // Relinking must never revive a job classification left active by a prior
  // partial write. Clear any old authority before the property becomes active.
  await revokeMembershipJobsForProperty({
    connectionId: projection.connection_id,
    externalPropertyId: projection.external_property_id,
    reason:
      "The Jobber property is being relinked and requires fresh membership-job verification",
  });

  const now = new Date().toISOString();
  if (!existing) {
    const { error } = await supabase.from("jobber_property_links").insert({
      connection_id: projection.connection_id,
      external_property_id: projection.external_property_id,
      property_id: membership.property_id,
      membership_id: membership.id,
      link_state: "active",
      linked_by: LINK_ACTOR,
      link_reason: LINK_REASON,
      linked_at: now,
    });
    if (error) throw error;
    return "linked";
  }

  const updateResult = await supabase
    .from("jobber_property_links")
    .update({
      property_id: membership.property_id,
      membership_id: membership.id,
      link_state: "active",
      linked_by: LINK_ACTOR,
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
  if (!existing) {
    return "already_jobber_only";
  }
  if (existing.link_state === "revoked") {
    await revokeMembershipJobsForProperty({
      connectionId: projection.connection_id,
      externalPropertyId: projection.external_property_id,
      reason: "Repairing cleanup after the verified Jobber property link was revoked",
    });
    const cancelledPortalVisits = await supabase
      .from("member_appointments")
      .update({
        status: "cancelled",
        verification_state: "unverified",
        completed_at: null,
      })
      .eq("provider", "jobber")
      .eq("property_id", existing.property_id)
      .eq("service_type", MEMBERSHIP_APPOINTMENT_TYPE)
      .eq("status", "scheduled");
    if (cancelledPortalVisits.error) throw cancelledPortalVisits.error;
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
      revoked_by: LINK_ACTOR,
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
  await revokeMembershipJobsForProperty({
    connectionId: projection.connection_id,
    externalPropertyId: projection.external_property_id,
    reason: "The verified Jobber property link was revoked",
  });
  const cancelledPortalVisits = await supabase
    .from("member_appointments")
    .update({
      status: "cancelled",
      verification_state: "unverified",
      completed_at: null,
    })
    .eq("provider", "jobber")
    .eq("property_id", existing.property_id)
    .eq("service_type", MEMBERSHIP_APPOINTMENT_TYPE)
    .eq("status", "scheduled");
  if (cancelledPortalVisits.error) throw cancelledPortalVisits.error;
  return "revoked";
}

export async function linkJobberMembershipJob(input: {
  projectionId: string;
  membershipServiceConfirmed: boolean;
  expectedJobLinkUpdatedAt?: string | null;
}): Promise<"linked" | "already_linked"> {
  if (input.membershipServiceConfirmed !== true) {
    throw new SupervisedPropertyMatchError(
      "Confirm that this Jobber job is the recurring membership service.",
      400,
    );
  }
  const projection = await loadProjectionIdentity(input.projectionId);
  const supabase = createServiceRoleSupabaseClient();
  const propertyLinkResult = await supabase
    .from("jobber_property_links")
    .select("id, membership_id, property_id, link_state")
    .eq("connection_id", projection.connection_id)
    .eq("external_property_id", projection.external_property_id)
    .eq("link_state", "active")
    .maybeSingle();
  if (propertyLinkResult.error) throw propertyLinkResult.error;
  if (!propertyLinkResult.data) {
    throw new SupervisedPropertyMatchError(
      "Confirm the member property before classifying this Jobber job.",
      409,
    );
  }
  const { membership } = await loadStrictMemberProperty(
    propertyLinkResult.data.membership_id as string,
  );
  if (membership.property_id !== propertyLinkResult.data.property_id) {
    throw new SupervisedPropertyMatchError(
      "The active Jobber property link no longer matches this membership.",
      409,
    );
  }

  const existingResult = await supabase
    .from("jobber_membership_job_links")
    .select(
      "id, connection_id, external_job_id, external_property_id, membership_id, property_id, link_state, updated_at",
    )
    .eq("connection_id", projection.connection_id)
    .eq("external_job_id", projection.external_job_id)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = (existingResult.data as JobLinkRow | null) ?? null;
  let outcome: "linked" | "already_linked" = "linked";
  if (existing?.link_state === "active") {
    if (
      existing.membership_id === membership.id &&
      existing.property_id === membership.property_id &&
      existing.external_property_id === projection.external_property_id
    ) {
      outcome = "already_linked";
    } else {
      throw new SupervisedPropertyMatchError(
        "This Jobber job is already classified for another membership.",
        409,
      );
    }
  }

  const now = new Date().toISOString();
  if (!existing) {
    const inserted = await supabase.from("jobber_membership_job_links").insert({
      connection_id: projection.connection_id,
      external_job_id: projection.external_job_id,
      external_property_id: projection.external_property_id,
      membership_id: membership.id,
      property_id: membership.property_id,
      link_state: "active",
      linked_by: LINK_ACTOR,
      link_reason: `${JOB_LINK_REASON}: ${projection.title || "Untitled Jobber job"}`,
      linked_at: now,
    });
    if (inserted.error) throw inserted.error;
  } else if (existing.link_state === "revoked") {
    if (
      !input.expectedJobLinkUpdatedAt ||
      input.expectedJobLinkUpdatedAt !== existing.updated_at
    ) {
      throw new SupervisedPropertyMatchError(
        "The Jobber job classification changed. Refresh and try again.",
        409,
      );
    }
    const updated = await supabase
      .from("jobber_membership_job_links")
      .update({
        membership_id: membership.id,
        property_id: membership.property_id,
        link_state: "active",
        linked_by: LINK_ACTOR,
        link_reason: `${JOB_LINK_REASON}: ${projection.title || "Untitled Jobber job"}`,
        linked_at: now,
        revoked_by: null,
        revoke_reason: null,
        revoked_at: null,
      })
      .eq("id", existing.id)
      .eq("updated_at", input.expectedJobLinkUpdatedAt)
      .select("id")
      .maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) {
      throw new SupervisedPropertyMatchError(
        "The Jobber job classification changed. Refresh and try again.",
        409,
      );
    }
  }

  const projections = await supabase
    .from("jobber_visit_projections")
    .update({
      match_state: "matched",
      matched_property_id: membership.property_id,
      matched_obligation_id: null,
    })
    .eq("connection_id", projection.connection_id)
    .eq("external_job_id", projection.external_job_id)
    .eq("external_property_id", projection.external_property_id);
  if (projections.error) throw projections.error;
  await reconcileAllPairedCustomerPortalVisits();
  return outcome;
}

export async function revokeJobberMembershipJob(input: {
  projectionId: string;
  expectedJobLinkUpdatedAt: string;
}): Promise<"revoked" | "already_unclassified"> {
  const projection = await loadProjectionIdentity(input.projectionId);
  const supabase = createServiceRoleSupabaseClient();
  const existingResult = await supabase
    .from("jobber_membership_job_links")
    .select(
      "id, connection_id, external_job_id, external_property_id, membership_id, property_id, link_state, updated_at",
    )
    .eq("connection_id", projection.connection_id)
    .eq("external_job_id", projection.external_job_id)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = (existingResult.data as JobLinkRow | null) ?? null;
  if (!existing) {
    return "already_unclassified";
  }
  if (existing.external_property_id !== projection.external_property_id) {
    throw new SupervisedPropertyMatchError(
      "The selected visit no longer belongs to this classified Jobber job property.",
      409,
    );
  }
  let outcome: "revoked" | "already_unclassified" = "already_unclassified";
  if (existing.link_state === "active") {
    if (existing.updated_at !== input.expectedJobLinkUpdatedAt) {
      throw new SupervisedPropertyMatchError(
        "The Jobber job classification changed. Refresh and try again.",
        409,
      );
    }
    const updated = await supabase
      .from("jobber_membership_job_links")
      .update({
        link_state: "revoked",
        revoked_by: LINK_ACTOR,
        revoke_reason: JOB_REVOKE_REASON,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("updated_at", input.expectedJobLinkUpdatedAt)
      .select("id")
      .maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) {
      throw new SupervisedPropertyMatchError(
        "The Jobber job classification changed. Refresh and try again.",
        409,
      );
    }
    outcome = "revoked";
  }
  const visitRows = await supabase
    .from("jobber_visit_projections")
    .select("external_visit_id")
    .eq("connection_id", projection.connection_id)
    .eq("external_job_id", projection.external_job_id)
    .eq("external_property_id", projection.external_property_id);
  if (visitRows.error) throw visitRows.error;
  const externalVisitIds = (visitRows.data ?? []).map(
    (row) => row.external_visit_id as string,
  );
  const projections = await supabase
    .from("jobber_visit_projections")
    .update({
      match_state: "manual_review",
      matched_property_id: null,
      matched_obligation_id: null,
    })
    .eq("connection_id", projection.connection_id)
    .eq("external_job_id", projection.external_job_id)
    .eq("external_property_id", projection.external_property_id);
  if (projections.error) throw projections.error;
  if (externalVisitIds.length > 0) {
    const appointments = await supabase
      .from("member_appointments")
      .update({
        status: "cancelled",
        verification_state: "unverified",
        completed_at: null,
      })
      .eq("provider", "jobber")
      .in("external_id", externalVisitIds);
    if (appointments.error) throw appointments.error;
  }
  return outcome;
}
