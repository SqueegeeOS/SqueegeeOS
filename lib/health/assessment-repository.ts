import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { isAssessmentAreaKey, type AssessmentAreaKey } from "./assessment-areas";
import {
  getLocalAssessmentById,
  listLocalAssessments,
  saveLocalAssessment,
} from "./assessment-local-store";
import {
  calculateAssessmentOverallScore,
  parseScoreValue,
  type AssessmentFormState,
  type AssessmentType,
  type PropertyAssessment,
  type RecommendedService,
  type ScoreValue,
} from "./assessment-types";
import type { CustomerHealthNote, CustomerHealthView, HealthScore } from "./types";
import { parseHealthScore } from "./types";

interface AssessmentRow {
  id: string;
  property_id: string;
  visit_id: string | null;
  assessment_type: AssessmentType;
  technician_name: string;
  visit_date: string;
  scores: Record<string, number | null>;
  assessed_areas: string[];
  na_areas: string[];
  overall_score: number | null;
  internal_note: string | null;
  customer_note: string | null;
  customer_note_visible: boolean;
  proposal_summary: string | null;
  recommended_services: RecommendedService[] | null;
  proposal_sent: boolean;
  proposal_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

function parseAreas(values: string[]): AssessmentAreaKey[] {
  return values.filter(isAssessmentAreaKey);
}

function rowToAssessment(row: AssessmentRow): PropertyAssessment {
  const scores: Record<string, ScoreValue> = {};
  for (const [key, value] of Object.entries(row.scores ?? {})) {
    scores[key] = parseScoreValue(value);
  }

  return {
    id: row.id,
    propertyId: row.property_id,
    visitId: row.visit_id,
    assessmentType: row.assessment_type,
    technicianName: row.technician_name,
    visitDate: row.visit_date,
    scores,
    assessedAreas: parseAreas(row.assessed_areas ?? []),
    naAreas: parseAreas(row.na_areas ?? []),
    overallScore:
      row.overall_score != null ? Number(row.overall_score) : null,
    internalNote: row.internal_note,
    customerNote: row.customer_note,
    customerNoteVisible: row.customer_note_visible,
    proposalSummary: row.proposal_summary,
    recommendedServices: row.recommended_services ?? [],
    proposalSent: row.proposal_sent,
    proposalSentAt: row.proposal_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildScoresJson(
  form: AssessmentFormState,
): Record<string, ScoreValue> {
  const scoresJson: Record<string, ScoreValue> = {};
  for (const key of form.activeAreas) {
    scoresJson[key] = form.naAreas.includes(key)
      ? null
      : (form.scores[key] ?? null);
  }
  return scoresJson;
}

function newAssessmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `assessment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function validateAssessmentForm(
  form: Partial<AssessmentFormState>,
): string | null {
  if (!form.propertyId?.trim()) return "propertyId is required.";
  if (!form.technicianName?.trim()) return "technicianName is required.";
  if (!form.visitDate?.trim()) return "visitDate is required.";
  if (!form.activeAreas?.length) return "At least one assessment area is required.";

  const scoreable = form.activeAreas.filter(
    (key) => !form.naAreas?.includes(key) && form.scores?.[key] != null,
  );
  if (scoreable.length === 0) return "Score at least one category.";

  return null;
}

export async function createPropertyAssessment(
  form: AssessmentFormState,
): Promise<{ assessment: PropertyAssessment; storage: "supabase" | "local" }> {
  const overallScore = calculateAssessmentOverallScore(
    form.scores,
    form.activeAreas,
    form.naAreas,
  );
  const scoresJson = buildScoresJson(form);
  const now = new Date().toISOString();

  if (isCloudPersistenceConnected()) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("property_assessments")
      .insert({
        property_id: form.propertyId,
        visit_id: form.visitId ?? null,
        assessment_type: form.assessmentType,
        technician_name: form.technicianName.trim(),
        visit_date: form.visitDate,
        scores: scoresJson,
        assessed_areas: form.activeAreas,
        na_areas: form.naAreas,
        overall_score: overallScore,
        internal_note: form.internalNote.trim() || null,
        customer_note: form.customerNote.trim() || null,
        customer_note_visible: form.customerNoteVisible,
        proposal_summary: form.proposalSummary.trim() || null,
        recommended_services:
          form.recommendedServices.length > 0
            ? form.recommendedServices
            : null,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return {
      assessment: rowToAssessment(data as AssessmentRow),
      storage: "supabase",
    };
  }

  const assessment: PropertyAssessment = {
    id: newAssessmentId(),
    propertyId: form.propertyId,
    visitId: form.visitId ?? null,
    assessmentType: form.assessmentType,
    technicianName: form.technicianName.trim(),
    visitDate: form.visitDate,
    scores: scoresJson,
    assessedAreas: [...form.activeAreas],
    naAreas: [...form.naAreas],
    overallScore,
    internalNote: form.internalNote.trim() || null,
    customerNote: form.customerNote.trim() || null,
    customerNoteVisible: form.customerNoteVisible,
    proposalSummary: form.proposalSummary.trim() || null,
    recommendedServices: [...form.recommendedServices],
    proposalSent: false,
    proposalSentAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await saveLocalAssessment(assessment);
  return { assessment, storage: "local" };
}

export async function listStaffAssessments(
  propertyId: string,
): Promise<PropertyAssessment[]> {
  if (isCloudPersistenceConnected()) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("property_assessments")
      .select("*")
      .eq("property_id", propertyId)
      .order("visit_date", { ascending: false });

    if (error) throw new Error(error.message);
    return ((data ?? []) as AssessmentRow[]).map(rowToAssessment);
  }

  return listLocalAssessments(propertyId);
}

export async function getAssessmentById(
  id: string,
): Promise<PropertyAssessment | null> {
  if (isCloudPersistenceConnected()) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("property_assessments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;
    return rowToAssessment(data as AssessmentRow);
  }

  return getLocalAssessmentById(id);
}

function scoreFromAssessment(
  assessment: PropertyAssessment,
  key: string,
): HealthScore | null {
  const raw = assessment.scores[key];
  if (raw == null || assessment.naAreas.includes(key as AssessmentAreaKey)) {
    return null;
  }
  return parseHealthScore(raw);
}

export function assessmentToCustomerView(
  assessment: PropertyAssessment,
): CustomerHealthView {
  return {
    visitDate: assessment.visitDate,
    overallScore: assessment.overallScore,
    windowHealth: scoreFromAssessment(assessment, "window_health"),
    screenHealth: scoreFromAssessment(assessment, "screen_health"),
    hardWaterRisk: scoreFromAssessment(assessment, "hard_water_risk"),
    customerNote:
      assessment.customerNoteVisible && assessment.customerNote
        ? assessment.customerNote
        : null,
  };
}

export async function listCustomerAssessments(
  propertyId: string,
): Promise<CustomerHealthView[]> {
  const assessments = await listStaffAssessments(propertyId);
  return assessments.map(assessmentToCustomerView);
}

export async function getLatestCustomerAssessment(
  propertyId: string,
): Promise<CustomerHealthView | null> {
  const views = await listCustomerAssessments(propertyId);
  return views[0] ?? null;
}

export function extractVisibleCustomerNotesFromAssessments(
  assessments: PropertyAssessment[],
): CustomerHealthNote[] {
  return assessments
    .filter((a) => a.customerNoteVisible && a.customerNote)
    .map((a) => ({
      visitDate: a.visitDate,
      customerNote: a.customerNote!,
    }));
}

export interface VisitMemorySummary {
  id: string;
  visitDate: string;
  technicianName: string;
  overallScore: number | null;
  assessmentType: AssessmentType | "legacy";
  source: "assessment" | "legacy";
}

export async function listVisitMemory(
  propertyId: string,
): Promise<VisitMemorySummary[]> {
  const { listStaffHealthChecks } = await import("./repository");
  const [assessments, legacyChecks] = await Promise.all([
    listStaffAssessments(propertyId),
    listStaffHealthChecks(propertyId),
  ]);

  const fromAssessments: VisitMemorySummary[] = assessments.map((a) => ({
    id: a.id,
    visitDate: a.visitDate,
    technicianName: a.technicianName,
    overallScore: a.overallScore,
    assessmentType: a.assessmentType,
    source: "assessment",
  }));

  const fromLegacy: VisitMemorySummary[] = legacyChecks.map((c) => ({
    id: c.id,
    visitDate: c.visitDate,
    technicianName: c.technicianName,
    overallScore: c.overallScore,
    assessmentType: "legacy",
    source: "legacy",
  }));

  return [...fromAssessments, ...fromLegacy].sort((a, b) =>
    b.visitDate.localeCompare(a.visitDate),
  );
}

export async function getLatestVisitMemory(
  propertyId: string,
): Promise<VisitMemorySummary | null> {
  const items = await listVisitMemory(propertyId);
  return items[0] ?? null;
}

export async function getLatestCustomerHealthUnified(
  propertyId: string,
): Promise<CustomerHealthView | null> {
  const assessment = await getLatestCustomerAssessment(propertyId);
  if (assessment) return assessment;

  const { getLatestCustomerHealth } = await import("./repository");
  return getLatestCustomerHealth(propertyId);
}
