import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import type {
  CreateLeadIntakeInput,
  LeadIntakeRecord,
} from "../lead-record";
import { saveLocalLeadIntake } from "./local-store";

interface LeadIntakeRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  service_address: string;
  services_interested: string[];
  preferred_contact_method: string;
  notes: string;
  membership_tier: string | null;
  square_footage: number | null;
  estimated_visit_price: number | null;
  preferred_start_window: string | null;
  status: string;
  submitted_at: string;
  source: string;
}

function newLeadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function rowToRecord(row: LeadIntakeRow): LeadIntakeRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    serviceAddress: row.service_address,
    servicesInterested: row.services_interested as LeadIntakeRecord["servicesInterested"],
    preferredContactMethod:
      row.preferred_contact_method as LeadIntakeRecord["preferredContactMethod"],
    notes: row.notes,
    membershipTier: row.membership_tier as LeadIntakeRecord["membershipTier"],
    squareFootage: row.square_footage,
    estimatedVisitPrice: row.estimated_visit_price,
    preferredStartWindow: row.preferred_start_window,
    status: row.status as LeadIntakeRecord["status"],
    submittedAt: row.submitted_at,
    source: "request_form",
  };
}

function inputToRow(
  id: string,
  input: CreateLeadIntakeInput,
  submittedAt: string,
): Record<string, unknown> {
  return {
    id,
    name: input.name,
    phone: input.phone,
    email: input.email,
    service_address: input.serviceAddress,
    services_interested: input.servicesInterested,
    preferred_contact_method: input.preferredContactMethod,
    notes: input.notes,
    membership_tier: input.membershipTier,
    square_footage: input.squareFootage,
    estimated_visit_price: input.estimatedVisitPrice,
    preferred_start_window: input.preferredStartWindow,
    status: "new",
    submitted_at: submittedAt,
    source: "request_form",
  };
}

export async function listLeadIntakes(): Promise<LeadIntakeRecord[]> {
  if (!isCloudPersistenceConnected()) {
    return [];
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lead_intakes")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error || !data) {
    throw new Error(`Failed to list lead intakes: ${error?.message ?? "unknown"}`);
  }

  return (data as LeadIntakeRow[]).map(rowToRecord);
}

export async function getLeadIntakeById(
  id: string,
): Promise<LeadIntakeRecord | null> {
  if (!isCloudPersistenceConnected()) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lead_intakes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load lead intake: ${error.message}`);
  }

  if (!data) return null;
  return rowToRecord(data as LeadIntakeRow);
}

export async function updateLeadIntakeStatus(
  id: string,
  status: LeadIntakeRecord["status"],
): Promise<LeadIntakeRecord | null> {
  if (!isCloudPersistenceConnected()) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lead_intakes")
    .update({ status })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update lead intake: ${error.message}`);
  }

  if (!data) return null;
  return rowToRecord(data as LeadIntakeRow);
}

export async function createLeadIntake(
  input: CreateLeadIntakeInput,
): Promise<{ record: LeadIntakeRecord; storage: "supabase" | "local" }> {
  const id = newLeadId();
  const submittedAt = new Date().toISOString();

  const record: LeadIntakeRecord = {
    id,
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    serviceAddress: input.serviceAddress.trim(),
    servicesInterested: input.servicesInterested,
    preferredContactMethod: input.preferredContactMethod,
    notes: input.notes.trim(),
    membershipTier: input.membershipTier,
    squareFootage: input.squareFootage,
    estimatedVisitPrice: input.estimatedVisitPrice,
    preferredStartWindow: input.preferredStartWindow,
    status: "new",
    submittedAt,
    source: "request_form",
  };

  if (isCloudPersistenceConnected()) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("lead_intakes")
      .insert(inputToRow(id, input, submittedAt))
      .select()
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to save lead intake: ${error?.message ?? "unknown error"}`,
      );
    }

    return { record: rowToRecord(data as LeadIntakeRow), storage: "supabase" };
  }

  const saved = await saveLocalLeadIntake(record);
  return { record: saved, storage: "local" };
}
