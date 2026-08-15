import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  annualCareCheckinOpportunity,
  isReviewOpportunityReady,
  reviewOpportunityTaskKey,
  REVIEW_OPPORTUNITY_READY_MS,
  REVIEW_OPPORTUNITY_WINDOW_MS,
  type CustomerAftercareSnapshot,
  type CustomerAftercareTask,
} from "./customer-aftercare";

interface MembershipRow {
  id: string;
  homeowner_id: string;
  property_id: string;
  started_at: string;
}

interface AppointmentRow {
  id: string;
  member_profile_id: string;
  property_id: string;
  service_type: string;
  completed_at: string;
}

interface MemberProfileRow {
  id: string;
  homeowner_id: string;
}

interface AssessmentRow {
  visit_id: string;
  field_record_id: string | null;
  follow_up_status: string | null;
  customer_note_visible: boolean;
}

interface PropertyAssetRow {
  visit_id: string;
}

interface HomeownerRow {
  id: string;
  full_name: string;
}

interface PropertyRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
}

interface ResolutionRow {
  task_key: string;
}

const SOURCE_LIMIT = 500;
const RESULT_LIMIT = 100;
const RESOLUTION_QUERY_CHUNK = 75;

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function serviceLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim() || "Service visit";
}

function propertyLabel(property: PropertyRow | undefined): string {
  if (!property) return "HomeAtlas property";
  return [property.name, property.address, property.city, property.state]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * Derives open aftercare work from durable records. This function only reads;
 * an explicit authenticated command records a disposition in another module.
 */
export async function loadCustomerAftercareSnapshot(
  referenceDate = new Date(),
): Promise<CustomerAftercareSnapshot> {
  const supabase = createServiceRoleSupabaseClient();
  const completedWindowStart = new Date(
    referenceDate.getTime() - REVIEW_OPPORTUNITY_WINDOW_MS,
  );
  const completedReadyCutoff = new Date(
    referenceDate.getTime() - REVIEW_OPPORTUNITY_READY_MS,
  );

  const [membershipResult, appointmentResult] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, homeowner_id, property_id, started_at")
      .eq("status", "active")
      .not("started_at", "is", null)
      .order("started_at", { ascending: true })
      .limit(SOURCE_LIMIT + 1),
    supabase
      .from("member_appointments")
      .select("id, member_profile_id, property_id, service_type, completed_at")
      .eq("provider", "jobber")
      .eq("status", "completed")
      .eq("verification_state", "verified")
      .eq("match_state", "matched")
      .not("completed_at", "is", null)
      .gte("completed_at", completedWindowStart.toISOString())
      .lte("completed_at", completedReadyCutoff.toISOString())
      .order("completed_at", { ascending: false })
      .limit(SOURCE_LIMIT + 1),
  ]);
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  if (appointmentResult.error) throw new Error(appointmentResult.error.message);

  const returnedMemberships = (membershipResult.data ?? []) as MembershipRow[];
  const returnedAppointments = (appointmentResult.data ?? []) as AppointmentRow[];
  const sourceTruncated =
    returnedMemberships.length > SOURCE_LIMIT ||
    returnedAppointments.length > SOURCE_LIMIT;
  const memberships = returnedMemberships.slice(0, SOURCE_LIMIT);
  const appointments = returnedAppointments.slice(0, SOURCE_LIMIT);

  const profileIds = unique(appointments.map((row) => row.member_profile_id));
  const appointmentIds = unique(appointments.map((row) => row.id));
  const homeownerIds = unique(memberships.map((row) => row.homeowner_id));
  const propertyIds = unique([
    ...memberships.map((row) => row.property_id),
    ...appointments.map((row) => row.property_id),
  ]);

  const [profileResult, assessmentResult, assetResult, homeownerResult, propertyResult] =
    await Promise.all([
      profileIds.length
        ? supabase
            .from("member_profiles")
            .select("id, homeowner_id")
            .in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      appointmentIds.length
        ? supabase
            .from("property_assessments")
            .select(
              "visit_id, field_record_id, follow_up_status, customer_note_visible",
            )
            .in("visit_id", appointmentIds)
        : Promise.resolve({ data: [], error: null }),
      appointmentIds.length
        ? supabase
            .from("property_assets")
            .select("visit_id")
            .in("visit_id", appointmentIds)
            .eq("kind", "photo")
            .eq("customer_visible", true)
        : Promise.resolve({ data: [], error: null }),
      homeownerIds.length
        ? supabase
            .from("homeowners")
            .select("id, full_name")
            .in("id", homeownerIds)
        : Promise.resolve({ data: [], error: null }),
      propertyIds.length
        ? supabase
            .from("properties")
            .select("id, name, address, city, state")
            .in("id", propertyIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  for (const result of [
    profileResult,
    assessmentResult,
    assetResult,
    homeownerResult,
    propertyResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const profilesById = new Map(
    ((profileResult.data ?? []) as MemberProfileRow[]).map((row) => [row.id, row]),
  );
  const assessmentsByVisitId = new Map<
    string,
    {
      hasFieldRecord: boolean;
      hasOpenFollowUp: boolean;
      customerSummaryVisible: boolean;
    }
  >();
  for (const row of (assessmentResult.data ?? []) as AssessmentRow[]) {
    const current = assessmentsByVisitId.get(row.visit_id) ?? {
      hasFieldRecord: false,
      hasOpenFollowUp: false,
      customerSummaryVisible: false,
    };
    assessmentsByVisitId.set(row.visit_id, {
      hasFieldRecord: current.hasFieldRecord || Boolean(row.field_record_id),
      hasOpenFollowUp:
        current.hasOpenFollowUp || row.follow_up_status === "open",
      customerSummaryVisible:
        current.customerSummaryVisible || row.customer_note_visible,
    });
  }
  const visitsWithVisiblePhoto = new Set(
    ((assetResult.data ?? []) as PropertyAssetRow[]).map((row) => row.visit_id),
  );
  const homeownersById = new Map(
    ((homeownerResult.data ?? []) as HomeownerRow[]).map((row) => [row.id, row]),
  );
  const propertiesById = new Map(
    ((propertyResult.data ?? []) as PropertyRow[]).map((row) => [row.id, row]),
  );
  const membershipsByCustomerProperty = new Map(
    memberships.map((membership) => [
      `${membership.homeowner_id}:${membership.property_id}`,
      membership,
    ]),
  );

  const tasks: CustomerAftercareTask[] = [];
  for (const membership of memberships) {
    const opportunity = annualCareCheckinOpportunity({
      membershipId: membership.id,
      membershipStartedAt: membership.started_at,
      now: referenceDate,
    });
    if (!opportunity) continue;
    tasks.push({
      taskKey: opportunity.taskKey,
      type: "annual_care_checkin",
      homeownerId: membership.homeowner_id,
      propertyId: membership.property_id,
      membershipId: membership.id,
      appointmentId: null,
      homeownerName:
        homeownersById.get(membership.homeowner_id)?.full_name?.trim() ||
        "HomeAtlas member",
      propertyLabel: propertyLabel(propertiesById.get(membership.property_id)),
      dueAt: opportunity.dueAt,
      evidenceAt: membership.started_at,
      membershipStartedAt: membership.started_at,
      anniversaryNumber: opportunity.anniversaryNumber,
    });
  }

  for (const appointment of appointments) {
    if (!isReviewOpportunityReady(appointment.completed_at, referenceDate)) continue;
    const profile = profilesById.get(appointment.member_profile_id);
    if (!profile) continue;
    const membership = membershipsByCustomerProperty.get(
      `${profile.homeowner_id}:${appointment.property_id}`,
    );
    if (!membership) continue;
    const assessment = assessmentsByVisitId.get(appointment.id);
    if (!assessment?.hasFieldRecord || assessment.hasOpenFollowUp) {
      continue;
    }
    const customerPhotoVisible = visitsWithVisiblePhoto.has(appointment.id);
    const customerSummaryVisible = assessment.customerSummaryVisible;
    if (!customerPhotoVisible && !customerSummaryVisible) continue;
    const taskKey = reviewOpportunityTaskKey(appointment.id);
    if (!taskKey) continue;
    tasks.push({
      taskKey,
      type: "review_opportunity",
      homeownerId: membership.homeowner_id,
      propertyId: membership.property_id,
      membershipId: membership.id,
      appointmentId: appointment.id,
      homeownerName:
        homeownersById.get(membership.homeowner_id)?.full_name?.trim() ||
        "HomeAtlas member",
      propertyLabel: propertyLabel(propertiesById.get(membership.property_id)),
      dueAt: new Date(
        Date.parse(appointment.completed_at) + REVIEW_OPPORTUNITY_READY_MS,
      ).toISOString(),
      evidenceAt: appointment.completed_at,
      serviceLabel: serviceLabel(appointment.service_type),
      completedAt: appointment.completed_at,
      customerSummaryVisible,
      customerPhotoVisible,
    });
  }

  tasks.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const taskKeys = tasks.map((task) => task.taskKey);
  const resolutionQueries = taskKeys.length
    ? chunks(taskKeys, RESOLUTION_QUERY_CHUNK).map((taskKeyChunk) =>
        supabase
          .from("customer_aftercare_resolutions")
          .select("task_key")
          .in("task_key", taskKeyChunk),
      )
    : [
        supabase
          .from("customer_aftercare_resolutions")
          .select("task_key")
          .limit(1),
      ];
  const resolutionResults = await Promise.all(resolutionQueries);
  const resolvedTaskKeys = new Set<string>();
  for (const result of resolutionResults) {
    if (result.error) throw new Error(result.error.message);
    for (const row of (result.data ?? []) as ResolutionRow[]) {
      resolvedTaskKeys.add(row.task_key);
    }
  }
  const openTasks = tasks.filter((task) => !resolvedTaskKeys.has(task.taskKey));

  return {
    generatedAt: referenceDate.toISOString(),
    tasks: openTasks.slice(0, RESULT_LIMIT),
    truncated: sourceTruncated || openTasks.length > RESULT_LIMIT,
  };
}
