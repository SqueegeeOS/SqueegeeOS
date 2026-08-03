import "server-only";

import { normalizeIdempotencyKey } from "@/lib/communications/providers/contracts";
import {
  getCommunicationConversation,
  normalizeCustomerPhone,
} from "@/lib/communications/repository";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export type HqSmsConsentAction = "record_opt_in" | "record_opt_out";

export interface ValidatedHqSmsConsentInput {
  action: HqSmsConsentAction;
  phone: string;
  evidenceNote: string;
  attested: boolean;
  idempotencyKey: string;
}

export class HqSmsConsentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "HqSmsConsentError";
  }
}

export function validateHqSmsConsentInput(input: {
  action: unknown;
  phone: unknown;
  evidenceNote: unknown;
  attested: unknown;
  idempotencyKey: unknown;
}): ValidatedHqSmsConsentInput {
  if (input.action !== "record_opt_in" && input.action !== "record_opt_out") {
    throw new HqSmsConsentError("Choose a valid text-consent action.", 400, "invalid_action");
  }
  const phone =
    typeof input.phone === "string" ? normalizeCustomerPhone(input.phone) : null;
  if (!phone) {
    throw new HqSmsConsentError(
      "A valid customer mobile number is required.",
      422,
      "invalid_phone",
    );
  }
  const idempotencyKey =
    typeof input.idempotencyKey === "string"
      ? normalizeIdempotencyKey(input.idempotencyKey)
      : null;
  if (!idempotencyKey || idempotencyKey.length < 12) {
    throw new HqSmsConsentError(
      "The consent decision could not be safely identified.",
      400,
      "invalid_idempotency_key",
    );
  }

  const evidenceNote =
    typeof input.evidenceNote === "string" ? input.evidenceNote.trim() : "";
  if (evidenceNote.length > 1_000) {
    throw new HqSmsConsentError(
      "Keep consent evidence under 1,000 characters.",
      400,
      "evidence_too_long",
    );
  }
  if (input.action === "record_opt_in") {
    if (input.attested !== true) {
      throw new HqSmsConsentError(
        "Confirm the customer explicitly approved texts to this exact number.",
        409,
        "explicit_attestation_required",
      );
    }
    if (evidenceNote.length < 12) {
      throw new HqSmsConsentError(
        "Record when and how the customer explicitly approved texting.",
        409,
        "consent_evidence_required",
      );
    }
  }

  return {
    action: input.action,
    phone,
    evidenceNote,
    attested: input.attested === true,
    idempotencyKey,
  };
}

export async function recordHqSmsConsentDecision(input: {
  conversationId: string;
  decision: ValidatedHqSmsConsentInput;
  actor: string;
  sourcePath: string;
  requestIp: string | null;
  userAgent: string | null;
}): Promise<{
  contactPointId: string;
  consentStatus: "opted_in" | "opted_out";
  verificationStatus: "verified";
  consentRecordedAt: string;
}> {
  const conversation = await getCommunicationConversation(input.conversationId);
  if (!conversation) {
    throw new HqSmsConsentError("Conversation not found.", 404, "not_found");
  }
  if (!conversation.homeownerId) {
    throw new HqSmsConsentError(
      "Convert this request to a customer before recording member text permission.",
      409,
      "homeowner_required",
    );
  }

  const supabase = createServiceRoleSupabaseClient();
  const homeowner = await supabase
    .from("homeowners")
    .select("phone")
    .eq("id", conversation.homeownerId)
    .maybeSingle();
  if (homeowner.error || !homeowner.data) {
    throw new HqSmsConsentError(
      "Customer phone record is unavailable.",
      503,
      "homeowner_phone_unavailable",
    );
  }
  const currentPhone = normalizeCustomerPhone(
    (homeowner.data as { phone?: string | null }).phone,
  );
  if (
    input.decision.action === "record_opt_in" &&
    (!currentPhone || currentPhone !== input.decision.phone)
  ) {
    throw new HqSmsConsentError(
      "The phone changed. Refresh the customer record and confirm permission for the exact current number.",
      409,
      "phone_changed",
    );
  }
  if (
    input.decision.action === "record_opt_out" &&
    currentPhone !== input.decision.phone
  ) {
    const existingPoint = await supabase
      .from("customer_contact_points")
      .select("id")
      .eq("homeowner_id", conversation.homeownerId)
      .eq("channel", "sms")
      .eq("address_normalized", input.decision.phone)
      .maybeSingle();
    if (existingPoint.error || !existingPoint.data) {
      throw new HqSmsConsentError(
        "This number is not attached to the customer. Refresh before recording the opt-out.",
        409,
        "phone_not_attached",
      );
    }
  }

  const nextStatus =
    input.decision.action === "record_opt_in" ? "opted_in" : "opted_out";
  const { data, error } = await supabase.rpc("record_hq_sms_consent_decision", {
    p_conversation_id: conversation.id,
    p_address_normalized: input.decision.phone,
    p_next_status: nextStatus,
    p_evidence_note: input.decision.evidenceNote,
    p_attested: input.decision.attested,
    p_recorded_by: input.actor,
    p_source_path: input.sourcePath,
    p_request_ip: input.requestIp,
    p_user_agent: input.userAgent,
    p_idempotency_key: input.decision.idempotencyKey,
  });
  if (error) {
    throw new HqSmsConsentError(
      "Text consent could not be recorded. Confirm migration 045 is installed and try again.",
      503,
      "consent_persistence_failed",
    );
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    contact_point_id?: string;
    consent_status?: string;
    verification_status?: string;
    consent_recorded_at?: string;
  } | null;
  if (
    !row?.contact_point_id ||
    row.consent_status !== nextStatus ||
    row.verification_status !== "verified" ||
    !row.consent_recorded_at
  ) {
    throw new HqSmsConsentError(
      "Text consent was not confirmed by storage.",
      503,
      "consent_confirmation_failed",
    );
  }
  return {
    contactPointId: row.contact_point_id,
    consentStatus: nextStatus,
    verificationStatus: "verified",
    consentRecordedAt: row.consent_recorded_at,
  };
}
