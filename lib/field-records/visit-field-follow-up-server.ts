import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  type ResolveVisitFieldFollowUpInput,
  type VisitFieldFollowUpView,
  validateResolveVisitFieldFollowUp,
} from "./visit-field-record";

interface FollowUpAssessmentRow {
  id: string;
  field_record_id: string | null;
  property_id: string;
  visit_id: string | null;
  technician_name: string;
  visit_date: string;
  customer_note: string | null;
  internal_note: string | null;
  follow_up_due_at: string | null;
  created_at: string;
}

interface FollowUpPropertyRow {
  id: string;
  homeowner_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
}

interface FollowUpHomeownerRow {
  id: string;
  full_name: string;
}

interface ResolveFollowUpRpcRow {
  assessment_id: string;
  resolved_at: string;
}

function isMissingFollowUpSchema(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const message = error.message?.toLocaleLowerCase("en-US") ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (message.includes("follow_up_status") &&
      (message.includes("does not exist") || message.includes("schema cache")))
  );
}

export async function loadOpenVisitFieldFollowUps(): Promise<
  VisitFieldFollowUpView[]
> {
  const supabase = createServiceRoleSupabaseClient();
  const assessmentResult = await supabase
    .from("property_assessments")
    .select(
      "id, field_record_id, property_id, visit_id, technician_name, visit_date, customer_note, internal_note, follow_up_due_at, created_at",
    )
    .eq("follow_up_status", "open")
    .order("follow_up_due_at", { ascending: true })
    .limit(50);

  if (assessmentResult.error) {
    if (isMissingFollowUpSchema(assessmentResult.error)) return [];
    throw new Error(assessmentResult.error.message);
  }

  const assessments = (assessmentResult.data ?? []) as FollowUpAssessmentRow[];
  if (assessments.length === 0) return [];

  const propertyIds = [...new Set(assessments.map((row) => row.property_id))];
  const propertyResult = await supabase
    .from("properties")
    .select("id, homeowner_id, name, address, city, state")
    .in("id", propertyIds);
  if (propertyResult.error) throw new Error(propertyResult.error.message);

  const properties = (propertyResult.data ?? []) as FollowUpPropertyRow[];
  if (properties.length === 0) return [];
  const homeownerIds = [
    ...new Set(properties.map((property) => property.homeowner_id)),
  ];
  const homeownerResult = await supabase
    .from("homeowners")
    .select("id, full_name")
    .in("id", homeownerIds);
  if (homeownerResult.error) throw new Error(homeownerResult.error.message);

  const propertiesById = new Map(
    properties.map((property) => [property.id, property]),
  );
  const homeownersById = new Map(
    ((homeownerResult.data ?? []) as FollowUpHomeownerRow[]).map((homeowner) => [
      homeowner.id,
      homeowner,
    ]),
  );

  return assessments.flatMap((assessment) => {
    const property = propertiesById.get(assessment.property_id);
    if (!property || !assessment.follow_up_due_at) {
      return [];
    }
    const homeowner = homeownersById.get(property.homeowner_id);
    return [
      {
        assessmentId: assessment.id,
        fieldRecordId: assessment.field_record_id,
        propertyId: assessment.property_id,
        appointmentId: assessment.visit_id,
        homeownerName: homeowner?.full_name?.trim() || "HomeAtlas member",
        propertyName: property.name,
        propertyAddress: [property.address, property.city, property.state]
          .filter(Boolean)
          .join(", "),
        technicianName: assessment.technician_name,
        visitDate: assessment.visit_date,
        customerSummary: assessment.customer_note,
        internalNote: assessment.internal_note,
        dueAt: assessment.follow_up_due_at,
        createdAt: assessment.created_at,
      } satisfies VisitFieldFollowUpView,
    ];
  });
}

export async function resolveVisitFieldFollowUp(
  input: ResolveVisitFieldFollowUpInput,
): Promise<{ assessmentId: string; resolvedAt: string }> {
  const validationError = validateResolveVisitFieldFollowUp(input);
  if (validationError) throw new Error(validationError);

  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .rpc("resolve_visit_field_follow_up", {
      p_assessment_id: input.assessmentId,
      p_resolved_by: input.resolvedBy.trim(),
    })
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Could not resolve the follow-up.");
  }

  const row = result.data as ResolveFollowUpRpcRow;
  return {
    assessmentId: row.assessment_id,
    resolvedAt: row.resolved_at,
  };
}
