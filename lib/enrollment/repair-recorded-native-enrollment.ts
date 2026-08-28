import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { completeManualPaymentHandoff } from "./manual-payment-handoff";
import { enrollmentMembershipBillingState } from "./membership-billing-state";
import type { EnrollmentPacketRow } from "./types";

type RecordedAgreement = {
  id: string;
  membership_id: string;
  homeowner_id: string;
  property_id: string;
  signed_at: string;
  agreement_pdf_url: string;
  status: string;
};

export async function repairRecordedNativeEnrollment(
  presentationId: string,
): Promise<{
  packetId: string;
  status: "portal_ready";
  membershipId: string;
  agreementId: string;
  portalUrl: string;
  emailSent: boolean;
}> {
  const supabase = createServiceRoleSupabaseClient();
  const packetResult = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("presentation_id", presentationId)
    .maybeSingle();
  if (packetResult.error || !packetResult.data) {
    throw new Error("The enrollment packet could not be found.");
  }
  let packet = packetResult.data as EnrollmentPacketRow;
  if (packet.signature_provider !== "homeatlas_native") {
    throw new Error("Only a HomeAtlas-native signature can use this repair.");
  }
  if (packet.payment_rail !== "manual_cash_check") {
    throw new Error("Only an owner-approved cash/check packet can use this repair.");
  }
  if (!packet.manual_payment_approved_at || !packet.manual_payment_approved_by) {
    throw new Error("The cash/check packet is missing owner approval evidence.");
  }

  if (
    packet.status === "portal_ready" &&
    packet.membership_id &&
    packet.signed_agreement_id
  ) {
    const handoff = await completeManualPaymentHandoff({
      packet,
      membershipId: packet.membership_id,
    });
    return {
      packetId: packet.id,
      status: "portal_ready",
      membershipId: packet.membership_id,
      agreementId: packet.signed_agreement_id,
      portalUrl: handoff.portalUrl,
      emailSent: handoff.emailSent,
    };
  }

  if (
    packet.status !== "needs_attention" ||
    packet.last_error_code !== "native_signature_completion_failed"
  ) {
    throw new Error("This packet does not have a recoverable recorded-signature failure.");
  }

  const agreementResult = await supabase
    .from("signed_agreements")
    .select(
      "id, membership_id, homeowner_id, property_id, signed_at, agreement_pdf_url, status",
    )
    .eq("external_signature_provider", "homeatlas_native")
    .eq("external_envelope_id", packet.id)
    .eq("status", "complete")
    .maybeSingle();
  if (agreementResult.error || !agreementResult.data) {
    throw new Error("No completed signature evidence exists for this packet.");
  }
  const agreement = agreementResult.data as RecordedAgreement;
  if (
    !agreement.id ||
    !agreement.membership_id ||
    !agreement.homeowner_id ||
    !agreement.property_id ||
    !agreement.signed_at ||
    !agreement.agreement_pdf_url?.trim()
  ) {
    throw new Error("The recorded signature evidence is incomplete and cannot be repaired safely.");
  }

  const membershipResult = await supabase
    .from("memberships")
    .select("id, presentation_id, property_id")
    .eq("id", agreement.membership_id)
    .maybeSingle();
  if (
    membershipResult.error ||
    !membershipResult.data ||
    membershipResult.data.presentation_id !== presentationId ||
    membershipResult.data.property_id !== agreement.property_id
  ) {
    throw new Error("The recorded membership does not match the signed packet.");
  }

  const membershipUpdate = await supabase
    .from("memberships")
    .update({
      agreement_id: agreement.id,
      status: "active",
      ...enrollmentMembershipBillingState({
        manualPayment: true,
        pausedAt: packet.manual_payment_approved_at,
      }),
      payment_rail: packet.payment_rail,
      manual_payment_approved_at: packet.manual_payment_approved_at,
      manual_payment_approved_by: packet.manual_payment_approved_by,
    })
    .eq("id", agreement.membership_id);
  if (membershipUpdate.error) throw new Error(membershipUpdate.error.message);

  const presentationUpdate = await supabase
    .from("presentations")
    .update({
      status: "signed",
      signed_at: agreement.signed_at,
      agreement_id: agreement.id,
      homeowner_id: agreement.homeowner_id,
      property_id: agreement.property_id,
      membership_id: agreement.membership_id,
      onboarding_status: "complete",
    })
    .eq("id", presentationId);
  if (presentationUpdate.error) throw new Error(presentationUpdate.error.message);

  const packetUpdate = await supabase
    .from("enrollment_packets")
    .update({
      status: "signature_complete",
      signed_at: agreement.signed_at,
      signed_agreement_id: agreement.id,
      membership_id: agreement.membership_id,
      homeowner_id: agreement.homeowner_id,
      property_id: agreement.property_id,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", packet.id)
    .select("*")
    .single();
  if (packetUpdate.error || !packetUpdate.data) {
    throw new Error(packetUpdate.error?.message ?? "The packet repair could not be saved.");
  }
  packet = packetUpdate.data as EnrollmentPacketRow;

  const event = await supabase.from("enrollment_packet_events").insert({
    enrollment_packet_id: packet.id,
    event_type: "signature_completion_repaired",
    actor: "homeatlas_hq",
    provider: "homeatlas_native",
    provider_event_key: `native:${packet.id}:repair:${agreement.id}`,
    event_data: {
      agreementId: agreement.id,
      membershipId: agreement.membership_id,
      signedAt: agreement.signed_at,
      repairReason: "manual_payment_billing_pause_state",
    },
  });
  if (event.error && event.error.code !== "23505") {
    throw new Error(event.error.message);
  }

  const handoff = await completeManualPaymentHandoff({
    packet,
    membershipId: agreement.membership_id,
  });
  return {
    packetId: packet.id,
    status: "portal_ready",
    membershipId: agreement.membership_id,
    agreementId: agreement.id,
    portalUrl: handoff.portalUrl,
    emailSent: handoff.emailSent,
  };
}
