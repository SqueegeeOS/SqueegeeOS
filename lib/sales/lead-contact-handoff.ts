import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeNorthAmericanPhone } from "./workspace-validation";

interface SalesLeadContactRow {
  id: string;
  phone_normalized: string | null;
  sms_consent_status: "unknown" | "opted_in" | "opted_out";
  sms_consent_recorded_at: string | null;
  sms_consent_disclosure_version: string | null;
  sms_consent_source_path: string | null;
}

interface ExistingSmsPointRow {
  id: string;
  homeowner_id: string;
}

export interface SalesLeadSmsHandoff {
  phone: string;
  verificationStatus: "unverified" | "verified";
  verifiedAt: string | null;
  consentStatus: "unknown" | "opted_in" | "opted_out";
  consentSource: string | null;
  consentRecordedAt: string | null;
}

export function resolveSalesLeadSmsHandoff(input: {
  presentationPhone: string | null | undefined;
  lead: SalesLeadContactRow;
}): SalesLeadSmsHandoff | null {
  const presentationPhone = normalizeNorthAmericanPhone(
    input.presentationPhone,
  );
  const leadPhone = normalizeNorthAmericanPhone(input.lead.phone_normalized);
  if (!presentationPhone || !leadPhone || presentationPhone !== leadPhone) {
    return null;
  }

  const hasConsentEvidence =
    input.lead.sms_consent_status !== "unknown" &&
    Boolean(input.lead.sms_consent_recorded_at);
  const consentStatus = hasConsentEvidence
    ? input.lead.sms_consent_status
    : "unknown";
  const consentRecordedAt = hasConsentEvidence
    ? input.lead.sms_consent_recorded_at
    : null;

  return {
    phone: presentationPhone,
    verificationStatus: consentStatus === "unknown" ? "unverified" : "verified",
    verifiedAt: consentRecordedAt,
    consentStatus,
    consentSource:
      consentStatus === "unknown"
        ? null
        : `sales_rep_lead:${input.lead.id}:${
            input.lead.sms_consent_disclosure_version ?? "field-consent"
          }`,
    consentRecordedAt,
  };
}

/**
 * Converts the field lead's exact-number consent into the canonical customer
 * contact point. A mismatched or unevidenced number fails closed to unknown.
 */
export async function preserveSalesLeadSmsHandoff(input: {
  supabase: SupabaseClient;
  homeownerId: string;
  salesRepLeadId: string | null;
  presentationPhone: string | null | undefined;
}): Promise<void> {
  if (!input.salesRepLeadId || !input.presentationPhone?.trim()) return;

  const leadResult = await input.supabase
    .from("sales_rep_leads")
    .select(
      "id, phone_normalized, sms_consent_status, sms_consent_recorded_at, sms_consent_disclosure_version, sms_consent_source_path",
    )
    .eq("id", input.salesRepLeadId)
    .maybeSingle();
  if (leadResult.error) throw new Error(leadResult.error.message);
  if (!leadResult.data) return;

  const handoff = resolveSalesLeadSmsHandoff({
    presentationPhone: input.presentationPhone,
    lead: leadResult.data as SalesLeadContactRow,
  });
  if (!handoff) return;

  const existingResult = await input.supabase
    .from("customer_contact_points")
    .select("id, homeowner_id")
    .eq("channel", "sms")
    .eq("address_normalized", handoff.phone)
    .maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);

  const existing = existingResult.data as ExistingSmsPointRow | null;
  if (existing && existing.homeowner_id !== input.homeownerId) {
    throw new Error("That mobile number is already attached to another customer.");
  }

  const demoted = await input.supabase
    .from("customer_contact_points")
    .update({ is_primary: false })
    .eq("homeowner_id", input.homeownerId)
    .eq("channel", "sms")
    .neq("address_normalized", handoff.phone)
    .eq("is_primary", true);
  if (demoted.error) throw new Error(demoted.error.message);

  const payload = {
    homeowner_id: input.homeownerId,
    channel: "sms",
    address_normalized: handoff.phone,
    address_masked: `***-***-${handoff.phone.replace(/\D/g, "").slice(-4)}`,
    is_primary: true,
    verification_status: handoff.verificationStatus,
    verified_at: handoff.verifiedAt,
    consent_status: handoff.consentStatus,
    consent_source: handoff.consentSource,
    consent_recorded_at: handoff.consentRecordedAt,
    opt_out_reason:
      handoff.consentStatus === "opted_out"
        ? "customer_opted_out_before_membership"
        : null,
  };
  const mutation = existing
    ? input.supabase
        .from("customer_contact_points")
        .update(payload)
        .eq("id", existing.id)
    : input.supabase.from("customer_contact_points").insert(payload);
  const result = await mutation;
  if (result.error) throw new Error(result.error.message);
}
