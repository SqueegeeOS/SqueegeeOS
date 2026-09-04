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
  sms_consent_status?: string | null;
  sms_consent_recorded_at?: string | null;
  notes: string;
  membership_tier: string | null;
  square_footage: number | null;
  estimated_visit_price: number | null;
  preferred_start_window: string | null;
  status: string;
  submitted_at: string;
  source: string;
  client_submission_id?: string | null;
  external_lead_id?: string | null;
  source_page_id?: string | null;
  source_form_id?: string | null;
  source_campaign_id?: string | null;
  source_campaign_name?: string | null;
  source_adset_id?: string | null;
  source_adset_name?: string | null;
  source_ad_id?: string | null;
  source_ad_name?: string | null;
  referred_by_technician_key?: string | null;
  referred_by_technician_name?: string | null;
  referral_permission_confirmed_at?: string | null;
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
    smsConsentStatus:
      (row.sms_consent_status as LeadIntakeRecord["smsConsentStatus"] | null) ??
      "unknown",
    smsConsentRecordedAt: row.sms_consent_recorded_at ?? null,
    notes: row.notes,
    membershipTier: row.membership_tier as LeadIntakeRecord["membershipTier"],
    squareFootage: row.square_footage,
    estimatedVisitPrice: row.estimated_visit_price,
    preferredStartWindow: row.preferred_start_window,
    status: row.status as LeadIntakeRecord["status"],
    submittedAt: row.submitted_at,
    source:
      row.source === "facebook_lead_ad"
        ? "facebook_lead_ad"
        : row.source === "technician_referral"
          ? "technician_referral"
          : "request_form",
    clientSubmissionId: row.client_submission_id ?? null,
    externalLeadId: row.external_lead_id ?? null,
    sourcePageId: row.source_page_id ?? null,
    sourceFormId: row.source_form_id ?? null,
    sourceCampaignId: row.source_campaign_id ?? null,
    sourceCampaignName: row.source_campaign_name ?? null,
    sourceAdsetId: row.source_adset_id ?? null,
    sourceAdsetName: row.source_adset_name ?? null,
    sourceAdId: row.source_ad_id ?? null,
    sourceAdName: row.source_ad_name ?? null,
    referredByTechnicianKey: row.referred_by_technician_key ?? null,
    referredByTechnicianName: row.referred_by_technician_name ?? null,
    referralPermissionConfirmedAt:
      row.referral_permission_confirmed_at ?? null,
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
    sms_consent_status: input.smsConsentStatus,
    sms_consent_recorded_at:
      input.smsConsentStatus === "opted_in" ? submittedAt : null,
    sms_consent_disclosure_version:
      input.smsConsentStatus === "opted_in"
        ? input.smsConsentDisclosureVersion ?? null
        : null,
    sms_consent_source_path:
      input.smsConsentStatus === "opted_in"
        ? input.smsConsentSourcePath ?? null
        : null,
    sms_consent_ip_address:
      input.smsConsentStatus === "opted_in"
        ? input.smsConsentIpAddress ?? null
        : null,
    sms_consent_user_agent:
      input.smsConsentStatus === "opted_in"
        ? input.smsConsentUserAgent ?? null
        : null,
    notes: input.notes,
    membership_tier: input.membershipTier,
    square_footage: input.squareFootage,
    estimated_visit_price: input.estimatedVisitPrice,
    preferred_start_window: input.preferredStartWindow,
    status: "new",
    submitted_at: submittedAt,
    source: input.source ?? "request_form",
    client_submission_id: input.clientSubmissionId?.trim() || null,
    external_lead_id: input.externalLeadId ?? null,
    source_page_id: input.sourcePageId ?? null,
    source_form_id: input.sourceFormId ?? null,
    source_campaign_id: input.sourceCampaignId ?? null,
    source_campaign_name: input.sourceCampaignName ?? null,
    source_adset_id: input.sourceAdsetId ?? null,
    source_adset_name: input.sourceAdsetName ?? null,
    source_ad_id: input.sourceAdId ?? null,
    source_ad_name: input.sourceAdName ?? null,
    referred_by_technician_key: input.referredByTechnicianKey ?? null,
    referred_by_technician_name: input.referredByTechnicianName ?? null,
    referral_permission_confirmed_at:
      input.referralPermissionConfirmedAt ?? null,
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

export async function removeLeadIntakeFromActiveHq(
  id: string,
): Promise<LeadIntakeRecord | null> {
  if (!isCloudPersistenceConnected()) return null;

  const supabase = createServerSupabaseClient();
  const leadUpdate = await supabase
    .from("lead_intakes")
    .update({ status: "archived" })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (leadUpdate.error) {
    throw new Error(`Failed to archive lead intake: ${leadUpdate.error.message}`);
  }
  if (!leadUpdate.data) return null;

  // This is deliberately separate from the normal "Mark lost" lifecycle.
  // Only the explicit test/fake cleanup action hides the linked thread.
  const conversationUpdate = await supabase
    .from("customer_conversations")
    .update({ status: "archived" })
    .eq("lead_intake_id", id);

  if (conversationUpdate.error) {
    throw new Error(
      `Lead was archived, but its conversation could not be hidden: ${conversationUpdate.error.message}`,
    );
  }

  return rowToRecord(leadUpdate.data as LeadIntakeRow);
}

export async function createLeadIntake(
  input: CreateLeadIntakeInput,
): Promise<{
  record: LeadIntakeRecord;
  storage: "supabase" | "local";
  duplicate: boolean;
}> {
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
    smsConsentStatus: input.smsConsentStatus,
    smsConsentRecordedAt:
      input.smsConsentStatus === "opted_in" ? submittedAt : null,
    notes: input.notes.trim(),
    membershipTier: input.membershipTier,
    squareFootage: input.squareFootage,
    estimatedVisitPrice: input.estimatedVisitPrice,
    preferredStartWindow: input.preferredStartWindow,
    status: "new",
    submittedAt,
    source: input.source ?? "request_form",
    clientSubmissionId: input.clientSubmissionId?.trim() || null,
    externalLeadId: input.externalLeadId ?? null,
    sourcePageId: input.sourcePageId ?? null,
    sourceFormId: input.sourceFormId ?? null,
    sourceCampaignId: input.sourceCampaignId ?? null,
    sourceCampaignName: input.sourceCampaignName ?? null,
    sourceAdsetId: input.sourceAdsetId ?? null,
    sourceAdsetName: input.sourceAdsetName ?? null,
    sourceAdId: input.sourceAdId ?? null,
    sourceAdName: input.sourceAdName ?? null,
    referredByTechnicianKey: input.referredByTechnicianKey ?? null,
    referredByTechnicianName: input.referredByTechnicianName ?? null,
    referralPermissionConfirmedAt:
      input.referralPermissionConfirmedAt ?? null,
  };

  if (isCloudPersistenceConnected()) {
    const supabase = createServerSupabaseClient();
    if (input.clientSubmissionId?.trim()) {
      const existing = await supabase
        .from("lead_intakes")
        .select("*")
        .eq("source", input.source ?? "request_form")
        .eq("client_submission_id", input.clientSubmissionId.trim())
        .maybeSingle();
      if (existing.error) {
        throw new Error(`Failed to check lead intake: ${existing.error.message}`);
      }
      if (existing.data) {
        return {
          record: rowToRecord(existing.data as LeadIntakeRow),
          storage: "supabase",
          duplicate: true,
        };
      }
    }
    if (input.externalLeadId?.trim()) {
      const existing = await supabase
        .from("lead_intakes")
        .select("*")
        .eq("source", input.source ?? "request_form")
        .eq("external_lead_id", input.externalLeadId.trim())
        .maybeSingle();
      if (existing.error) {
        throw new Error(`Failed to check lead intake: ${existing.error.message}`);
      }
      if (existing.data) {
        return {
          record: rowToRecord(existing.data as LeadIntakeRow),
          storage: "supabase",
          duplicate: true,
        };
      }
    }
    const { data, error } = await supabase
      .from("lead_intakes")
      .insert(inputToRow(id, input, submittedAt))
      .select()
      .single();

    if (error || !data) {
      if (input.clientSubmissionId?.trim() && error?.code === "23505") {
        const raced = await supabase
          .from("lead_intakes")
          .select("*")
          .eq("source", input.source ?? "request_form")
          .eq("client_submission_id", input.clientSubmissionId.trim())
          .maybeSingle();
        if (raced.data) {
          return {
            record: rowToRecord(raced.data as LeadIntakeRow),
            storage: "supabase",
            duplicate: true,
          };
        }
      }
      if (input.externalLeadId?.trim() && error?.code === "23505") {
        const raced = await supabase
          .from("lead_intakes")
          .select("*")
          .eq("source", input.source ?? "request_form")
          .eq("external_lead_id", input.externalLeadId.trim())
          .maybeSingle();
        if (raced.data) {
          return {
            record: rowToRecord(raced.data as LeadIntakeRow),
            storage: "supabase",
            duplicate: true,
          };
        }
      }
      throw new Error(
        `Failed to save lead intake: ${error?.message ?? "unknown error"}`,
      );
    }

    return {
      record: rowToRecord(data as LeadIntakeRow),
      storage: "supabase",
      duplicate: false,
    };
  }

  const saved = await saveLocalLeadIntake(record);
  return { record: saved, storage: "local", duplicate: false };
}
