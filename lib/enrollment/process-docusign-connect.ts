import "server-only";

import { createHash } from "node:crypto";
import {
  downloadDocuSignEnvelopeDocument,
  type DocuSignEnvelopeEvent,
} from "@/lib/integrations/docusign";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { completeRemoteEnrollmentSignature } from "./complete-remote-signature";
import { createEnrollmentStripeHandoff } from "./stripe-handoff";
import type { EnrollmentPacketRow } from "./types";

type PacketWithVersions = EnrollmentPacketRow & {
  msa_version_id: string;
  service_agreement_version_id: string;
};

function safeCompletedAt(value: string | null): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}
async function recordEvent(input: {
  packetId: string;
  eventType: string;
  providerEventKey: string;
  eventData: Record<string, unknown>;
}): Promise<"inserted" | "duplicate"> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase.from("enrollment_packet_events").insert({
    enrollment_packet_id: input.packetId,
    event_type: input.eventType,
    actor: "docusign_connect",
    provider: "docusign",
    provider_event_key: input.providerEventKey,
    event_data: input.eventData,
  });
  if (result.error?.code === "23505") return "duplicate";
  if (result.error) throw new Error(result.error.message);
  return "inserted";
}

export async function processDocuSignEnrollmentConnect(input: {
  event: DocuSignEnvelopeEvent;
  rawBody: string;
}): Promise<{
  status: "ignored" | "recorded" | "payment_sent" | "already_processed";
  packetId: string | null;
}> {
  const supabase = createServiceRoleSupabaseClient();
  const packetResult = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("docusign_envelope_id", input.event.envelopeId)
    .maybeSingle();
  if (packetResult.error) throw new Error(packetResult.error.message);
  if (!packetResult.data) {
    // An account-level Connect configuration can legitimately include
    // envelopes created outside HomeAtlas. A valid signed webhook for one of
    // those envelopes is acknowledged but never imported.
    return { status: "ignored", packetId: null };
  }
  let packet = packetResult.data as PacketWithVersions;
  const rawHash = createHash("sha256").update(input.rawBody).digest("hex");
  await recordEvent({
    packetId: packet.id,
    eventType: "docusign_webhook_received",
    providerEventKey: `connect:${rawHash}`,
    eventData: {
      eventType: input.event.eventType,
      status: input.event.status,
      envelopeId: input.event.envelopeId,
      generatedAt: input.event.generatedAt,
    },
  });

  const statusUpdate = await supabase
    .from("enrollment_packets")
    .update({ docusign_status: input.event.status })
    .eq("id", packet.id);
  if (statusUpdate.error) throw new Error(statusUpdate.error.message);

  const normalizedStatus = input.event.status.toLowerCase();
  if (normalizedStatus === "declined" || normalizedStatus === "voided") {
    const blocked = await supabase
      .from("enrollment_packets")
      .update({
        status: normalizedStatus === "voided" ? "voided" : "needs_attention",
        last_error_code: `docusign_${normalizedStatus}`,
        last_error_message:
          normalizedStatus === "declined"
            ? "The customer declined the DocuSign envelope."
            : "The DocuSign envelope was voided.",
      })
      .eq("id", packet.id);
    if (blocked.error) throw new Error(blocked.error.message);
    return { status: "recorded", packetId: packet.id };
  }
  if (normalizedStatus !== "completed") {
    return { status: "recorded", packetId: packet.id };
  }

  try {
    if (
      !packet.signed_agreement_id ||
      !packet.membership_id ||
      !packet.homeowner_id ||
      !packet.property_id
    ) {
      const [combinedPdf, certificatePdf] = await Promise.all([
        downloadDocuSignEnvelopeDocument({
          envelopeId: input.event.envelopeId,
          documentId: "combined",
        }),
        downloadDocuSignEnvelopeDocument({
          envelopeId: input.event.envelopeId,
          documentId: "certificate",
        }),
      ]);
      const completed = await completeRemoteEnrollmentSignature({
        packet,
        signedAt: safeCompletedAt(input.event.generatedAt),
        combinedPdf,
        certificatePdf,
      });
      const saveCompletion = await supabase
        .from("enrollment_packets")
        .update({
          status: "signature_complete",
          docusign_status: "completed",
          signed_at: safeCompletedAt(input.event.generatedAt),
          signed_agreement_id: completed.agreementId,
          membership_id: completed.membershipId,
          homeowner_id: completed.homeownerId,
          property_id: completed.propertyId,
          last_error_code: null,
          last_error_message: null,
        })
        .eq("id", packet.id);
      if (saveCompletion.error) throw new Error(saveCompletion.error.message);
      await recordEvent({
        packetId: packet.id,
        eventType: "signature_complete",
        providerEventKey: `envelope:${input.event.envelopeId}:completed`,
        eventData: {
          agreementId: completed.agreementId,
          membershipId: completed.membershipId,
          signedAt: safeCompletedAt(input.event.generatedAt),
        },
      });
    }

    const refreshed = await supabase
      .from("enrollment_packets")
      .select("*")
      .eq("id", packet.id)
      .single();
    if (refreshed.error) throw new Error(refreshed.error.message);
    packet = refreshed.data as PacketWithVersions;
    if (
      packet.status === "payment_sent" ||
      packet.status === "payment_complete" ||
      packet.status === "portal_ready"
    ) {
      return { status: "already_processed", packetId: packet.id };
    }
    if (!packet.membership_id) {
      throw new Error("Signed packet has no membership for Stripe setup.");
    }
    await createEnrollmentStripeHandoff({
      packet,
      membershipId: packet.membership_id,
    });
    return { status: "payment_sent", packetId: packet.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 2000) : "Unknown completion error";
    await supabase
      .from("enrollment_packets")
      .update({
        status: "needs_attention",
        last_error_code: "docusign_completion_failed",
        last_error_message: message,
      })
      .eq("id", packet.id);
    throw error;
  }
}
