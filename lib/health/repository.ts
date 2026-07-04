import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  calculateOverallScore,
  emptyHealthScores,
  parseHealthScore,
  type CustomerHealthNote,
  type CustomerHealthView,
  type HealthCheckFormState,
  type HealthScores,
  type PropertyHealthCheck,
} from "./types";
import { listLocalHealthChecks, saveLocalHealthCheck } from "./local-store";

interface HealthCheckRow {
  id: string;
  property_id: string;
  visit_id: string | null;
  technician_name: string;
  visit_date: string;
  window_health_score: number | null;
  screen_health_score: number | null;
  track_sill_health_score: number | null;
  frame_health_score: number | null;
  hard_water_risk_score: number | null;
  debris_buildup_score: number | null;
  overall_score: number | null;
  internal_note: string | null;
  customer_note: string | null;
  customer_note_visible: boolean;
  created_at: string;
  updated_at: string;
}

function scoresFromRow(row: HealthCheckRow): HealthScores {
  return {
    windowHealth: parseHealthScore(row.window_health_score),
    screenHealth: parseHealthScore(row.screen_health_score),
    trackSillHealth: parseHealthScore(row.track_sill_health_score),
    frameHealth: parseHealthScore(row.frame_health_score),
    hardWaterRisk: parseHealthScore(row.hard_water_risk_score),
    debrisBuildup: parseHealthScore(row.debris_buildup_score),
  };
}

function rowToCheck(row: HealthCheckRow): PropertyHealthCheck {
  return {
    id: row.id,
    propertyId: row.property_id,
    visitId: row.visit_id,
    technicianName: row.technician_name,
    visitDate: row.visit_date,
    scores: scoresFromRow(row),
    overallScore:
      row.overall_score != null ? Number(row.overall_score) : null,
    internalNote: row.internal_note,
    customerNote: row.customer_note,
    customerNoteVisible: row.customer_note_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToInsertRow(
  form: HealthCheckFormState,
  overallScore: number | null,
): Record<string, unknown> {
  return {
    property_id: form.propertyId,
    visit_id: form.visitId ?? null,
    technician_name: form.technicianName.trim(),
    visit_date: form.visitDate,
    window_health_score: form.scores.windowHealth,
    screen_health_score: form.scores.screenHealth,
    track_sill_health_score: form.scores.trackSillHealth,
    frame_health_score: form.scores.frameHealth,
    hard_water_risk_score: form.scores.hardWaterRisk,
    debris_buildup_score: form.scores.debrisBuildup,
    overall_score: overallScore,
    internal_note: form.internalNote.trim() || null,
    customer_note: form.customerNote.trim() || null,
    customer_note_visible: form.customerNoteVisible,
  };
}

function newCheckId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `health-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function toCustomerHealthView(
  check: PropertyHealthCheck,
): CustomerHealthView {
  return {
    visitDate: check.visitDate,
    overallScore: check.overallScore,
    windowHealth: check.scores.windowHealth,
    screenHealth: check.scores.screenHealth,
    hardWaterRisk: check.scores.hardWaterRisk,
    customerNote:
      check.customerNoteVisible && check.customerNote
        ? check.customerNote
        : null,
  };
}

export function extractVisibleCustomerNotes(
  checks: PropertyHealthCheck[],
): CustomerHealthNote[] {
  return checks
    .filter((c) => c.customerNoteVisible && c.customerNote)
    .map((c) => ({
      visitDate: c.visitDate,
      customerNote: c.customerNote!,
    }));
}

export async function createPropertyHealthCheck(
  form: HealthCheckFormState,
): Promise<{ check: PropertyHealthCheck; storage: "supabase" | "local" }> {
  const overallScore = calculateOverallScore(form.scores);
  const now = new Date().toISOString();

  if (isCloudPersistenceConnected()) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("property_visit_health_checks")
      .insert(formToInsertRow(form, overallScore))
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      check: rowToCheck(data as HealthCheckRow),
      storage: "supabase",
    };
  }

  const check: PropertyHealthCheck = {
    id: newCheckId(),
    propertyId: form.propertyId,
    visitId: form.visitId ?? null,
    technicianName: form.technicianName.trim(),
    visitDate: form.visitDate,
    scores: { ...form.scores },
    overallScore,
    internalNote: form.internalNote.trim() || null,
    customerNote: form.customerNote.trim() || null,
    customerNoteVisible: form.customerNoteVisible,
    createdAt: now,
    updatedAt: now,
  };

  await saveLocalHealthCheck(check);
  return { check, storage: "local" };
}

export async function listStaffHealthChecks(
  propertyId: string,
): Promise<PropertyHealthCheck[]> {
  if (isCloudPersistenceConnected()) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("property_visit_health_checks")
      .select("*")
      .eq("property_id", propertyId)
      .order("visit_date", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as HealthCheckRow[]).map(rowToCheck);
  }

  return listLocalHealthChecks(propertyId);
}

/** Customer-safe fetch — internal notes excluded at mapping layer. */
export async function listCustomerHealthChecks(
  propertyId: string,
): Promise<CustomerHealthView[]> {
  const checks = await listStaffHealthChecks(propertyId);
  return checks.map(toCustomerHealthView);
}

export async function getLatestCustomerHealth(
  propertyId: string,
): Promise<CustomerHealthView | null> {
  const checks = await listCustomerHealthChecks(propertyId);
  return checks[0] ?? null;
}

export async function getPropertyIdBySlugs(
  homeownerSlug: string,
  propertySlug: string,
): Promise<string | null> {
  if (isCloudPersistenceConnected()) {
    const supabase = createServerSupabaseClient();
    const { data: homeowner } = await supabase
      .from("homeowners")
      .select("id")
      .eq("slug", homeownerSlug)
      .maybeSingle();

    if (!homeowner?.id) return null;

    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("homeowner_id", homeowner.id)
      .eq("slug", propertySlug)
      .maybeSingle();

    return property?.id ?? null;
  }

  return `local-${homeownerSlug}-${propertySlug}`;
}

export interface PropertyHealthHeader {
  id: string;
  address: string;
  name: string;
  customerName: string;
}

export async function getPropertyHealthHeader(
  propertyId: string,
): Promise<PropertyHealthHeader | null> {
  if (isCloudPersistenceConnected()) {
    const supabase = createServerSupabaseClient();
    const { data: property, error } = await supabase
      .from("properties")
      .select("id, name, address, homeowner_id")
      .eq("id", propertyId)
      .maybeSingle();

    if (error || !property) return null;

    const { data: homeowner } = await supabase
      .from("homeowners")
      .select("full_name")
      .eq("id", property.homeowner_id)
      .maybeSingle();

    return {
      id: property.id,
      address: property.address,
      name: property.name,
      customerName: homeowner?.full_name ?? "",
    };
  }

  return {
    id: propertyId,
    address: "Property",
    name: "Property",
    customerName: "",
  };
}

export function validateHealthCheckForm(
  form: Partial<HealthCheckFormState>,
): string | null {
  if (!form.propertyId?.trim()) return "propertyId is required.";
  if (!form.technicianName?.trim()) return "technicianName is required.";
  if (!form.visitDate?.trim()) return "visitDate is required.";

  const scores = form.scores ?? emptyHealthScores();
  const hasAny = Object.values(scores).some((v) => v !== null);
  if (!hasAny) return "Score at least one category.";

  return null;
}
