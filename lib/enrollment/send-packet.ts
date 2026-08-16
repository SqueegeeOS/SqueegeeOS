import "server-only";

import { randomUUID } from "node:crypto";
import {
  createDocuSignEnrollmentEnvelope,
  sendCreatedDocuSignEnvelope,
} from "@/lib/integrations/docusign";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { PresentationData } from "@/lib/presentations/types";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import {
  buildEnrollmentDocumentSnapshot,
  normalizeEnrollmentEmail,
} from "./document-snapshot";
import { getEnrollmentReadiness } from "./readiness";
import { enrollmentTokenSha256, generateEnrollmentToken } from "./token";
import type {
  EnrollmentPacketRow,
  EnrollmentSalesContext,
} from "./types";

export class EnrollmentNotReadyError extends Error {
  constructor(
    message: string,
    readonly readiness: Awaited<ReturnType<typeof getEnrollmentReadiness>>,
  ) {
    super(message);
    this.name = "EnrollmentNotReadyError";
  }
}

async function recordPacketEvent(input: {
  packetId: string;
  eventType: string;
  actor: string;
  provider?: string | null;
  providerEventKey?: string | null;
  eventData?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase.from("enrollment_packet_events").insert({
    enrollment_packet_id: input.packetId,
    event_type: input.eventType,
    actor: input.actor,
    provider: input.provider ?? null,
    provider_event_key: input.providerEventKey ?? null,
    event_data: input.eventData ?? {},
  });
  if (result.error && result.error.code !== "23505") {
    throw new Error(`Enrollment audit event failed: ${result.error.message}`);
  }
}

function asPacket(row: unknown): EnrollmentPacketRow {
  return row as EnrollmentPacketRow;
}

async function flagPacketError(
  packetId: string,
  code: string,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error ? error.message.slice(0, 2000) : "Unknown provider error";
  const supabase = createServiceRoleSupabaseClient();
  await supabase
    .from("enrollment_packets")
    .update({
      status: "needs_attention",
      last_error_code: code,
      last_error_message: message,
    })
    .eq("id", packetId);
  await recordPacketEvent({
    packetId,
    eventType: "provider_error",
    actor: "homeatlas_server",
    provider: "docusign",
    eventData: { code, message },
  }).catch(() => {});
}

export async function sendEnrollmentPacket(input: {
  presentation: PresentationData;
  tier: SqueegeeKingTierId;
  firstVisitPrice: number;
  recurringVisitPrice: number;
  annualizedValue: number;
  salesContext: EnrollmentSalesContext;
  homeSolicitationNoticeDays: 3 | 5 | null;
}): Promise<{
  packetId: string;
  status: "signature_sent";
  customerEmail: string;
  envelopeId: string;
  reused: boolean;
}> {
  const readiness = await getEnrollmentReadiness();
  if (
    !readiness.readyToSend ||
    !readiness.approvedVersions.msa ||
    !readiness.approvedVersions.serviceQuote ||
    !readiness.legalIdentity
  ) {
    throw new EnrollmentNotReadyError(
      "The enrollment handoff is safely paused until legal and provider setup is complete.",
      readiness,
    );
  }

  const snapshot = buildEnrollmentDocumentSnapshot({
    presentation: input.presentation,
    tier: input.tier,
    firstVisitPrice: input.firstVisitPrice,
    recurringVisitPrice: input.recurringVisitPrice,
    annualizedValue: input.annualizedValue,
    salesContext: input.salesContext,
    homeSolicitationNoticeDays: input.homeSolicitationNoticeDays,
  });
  const email = normalizeEnrollmentEmail(input.presentation.clientEmail)!;
  const supabase = createServiceRoleSupabaseClient();
  const existingResult = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("presentation_id", input.presentation.id)
    .maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);
  let packet = existingResult.data ? asPacket(existingResult.data) : null;

  if (packet?.status === "voided") {
    throw new Error(
      "This enrollment envelope was voided. Start a replacement packet before sending again.",
    );
  }

  if (
    packet?.docusign_envelope_id &&
    packet.status !== "needs_attention" &&
    packet.status !== "draft"
  ) {
    return {
      packetId: packet.id,
      status: "signature_sent",
      customerEmail: packet.customer_email,
      envelopeId: packet.docusign_envelope_id,
      reused: true,
    };
  }

  const now = new Date();
  const rawToken = generateEnrollmentToken();
  const packetValues = {
    customer_name: snapshot.customer.name,
    customer_email: snapshot.customer.email,
    agreement_tier: input.tier,
    first_visit_price_cents: snapshot.plan.firstVisitPriceCents,
    recurring_visit_price_cents: snapshot.plan.recurringVisitPriceCents,
    annualized_value_cents: snapshot.plan.annualizedValueCents,
    sales_context: input.salesContext,
    home_solicitation_notice_days: input.homeSolicitationNoticeDays,
    msa_version_id: readiness.approvedVersions.msa.id,
    service_agreement_version_id: readiness.approvedVersions.serviceQuote.id,
    document_snapshot: snapshot,
    public_token_sha256: enrollmentTokenSha256(rawToken),
    public_token_expires_at: new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    status: "draft",
    last_error_code: null,
    last_error_message: null,
  };

  if (!packet) {
    const packetId = randomUUID();
    const createResult = await supabase
      .from("enrollment_packets")
      .insert({
        id: packetId,
        presentation_id: input.presentation.id,
        ...packetValues,
      })
      .select("*")
      .single();
    if (createResult.error) throw new Error(createResult.error.message);
    packet = asPacket(createResult.data);
    await recordPacketEvent({
      packetId,
      eventType: "packet_created",
      actor: "homeatlas_hq",
      eventData: {
        presentationId: input.presentation.id,
        msaVersion: readiness.approvedVersions.msa.version,
        serviceAgreementVersion: readiness.approvedVersions.serviceQuote.version,
      },
    });
  } else if (!packet.docusign_envelope_id) {
    const updateResult = await supabase
      .from("enrollment_packets")
      .update(packetValues)
      .eq("id", packet.id)
      .select("*")
      .single();
    if (updateResult.error) throw new Error(updateResult.error.message);
    packet = asPacket(updateResult.data);
    await recordPacketEvent({
      packetId: packet.id,
      eventType: "packet_reprepared",
      actor: "homeatlas_hq",
    });
  }

  let envelopeId = packet.docusign_envelope_id;
  if (!envelopeId) {
    try {
      const envelope = await createDocuSignEnrollmentEnvelope({
        packetId: packet.id,
        snapshot,
        legalCompanyName: readiness.legalIdentity.companyName,
        legalBusinessAddress: readiness.legalIdentity.businessAddress,
        legalNoticeEmail: readiness.legalIdentity.noticeEmail,
        legalPhone: readiness.legalIdentity.phone,
      });
      envelopeId = envelope.envelopeId;
      const saveEnvelope = await supabase
        .from("enrollment_packets")
        .update({
          docusign_envelope_id: envelopeId,
          docusign_status: envelope.status,
          status: "draft",
        })
        .eq("id", packet.id);
      if (saveEnvelope.error) {
        throw new Error(
          `DocuSign envelope was prepared but could not be bound to HomeAtlas: ${saveEnvelope.error.message}`,
        );
      }
      await recordPacketEvent({
        packetId: packet.id,
        eventType: "docusign_envelope_created",
        actor: "homeatlas_server",
        provider: "docusign",
        providerEventKey: `envelope:${envelopeId}:created`,
        eventData: { envelopeId },
      });
    } catch (error) {
      await flagPacketError(packet.id, "docusign_create_failed", error);
      throw error;
    }
  }

  try {
    await sendCreatedDocuSignEnvelope({ envelopeId });
    const sentAt = new Date().toISOString();
    const markSent = await supabase
      .from("enrollment_packets")
      .update({
        status: "signature_sent",
        docusign_status: "sent",
        signature_sent_at: sentAt,
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", packet.id);
    if (markSent.error) throw new Error(markSent.error.message);
    await recordPacketEvent({
      packetId: packet.id,
      eventType: "signature_email_sent",
      actor: "homeatlas_server",
      provider: "docusign",
      providerEventKey: `envelope:${envelopeId}:sent`,
      eventData: { recipient: email, sentAt },
    });
  } catch (error) {
    await flagPacketError(packet.id, "docusign_send_failed", error);
    throw error;
  }

  return {
    packetId: packet.id,
    status: "signature_sent",
    customerEmail: email,
    envelopeId,
    reused: false,
  };
}
