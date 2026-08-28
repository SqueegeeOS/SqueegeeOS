import "server-only";

import { randomUUID } from "node:crypto";
import {
  createDocuSignEnrollmentEnvelope,
  sendCreatedDocuSignEnvelope,
} from "@/lib/integrations/docusign";
import { sendResendEmail } from "@/lib/communications/providers/resend-email";
import { resolvePublicAppOrigin } from "@/lib/membership/portal-access";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { PresentationData } from "@/lib/presentations/types";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import {
  buildEnrollmentDocumentSnapshot,
  normalizeEnrollmentEmail,
} from "./document-snapshot";
import {
  enrollmentReadyForHandoff,
  getEnrollmentReadiness,
} from "./readiness";
import { enrollmentTokenSha256, generateEnrollmentToken } from "./token";
import type {
  EnrollmentPacketRow,
  EnrollmentSalesContext,
  EnrollmentSignatureProvider,
} from "./types";
import type { PaymentRail } from "@/lib/billing/payment-rail";
import { getEnrollmentRecipientGate } from "./release-control";
import { buildSignatureInvitationEmail } from "./signature-invitation-email";

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
  provider = "docusign",
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
    provider,
    eventData: { code, message },
  }).catch(() => {});
}

export async function sendEnrollmentPacket(input: {
  presentation: PresentationData;
  signer?: {
    name: string;
    email: string;
    phone?: string | null;
  };
  tier: SqueegeeKingTierId;
  firstVisitPrice: number;
  recurringVisitPrice: number;
  annualizedValue: number;
  salesContext: EnrollmentSalesContext;
  homeSolicitationNoticeDays: 3 | 5 | null;
  paymentRail: PaymentRail;
  signatureProvider: EnrollmentSignatureProvider;
  actor: string;
}): Promise<{
  packetId: string;
  status: "signature_sent";
  customerEmail: string;
  envelopeId: string | null;
  reused: boolean;
}> {
  const readiness = await getEnrollmentReadiness();
  if (
    !enrollmentReadyForHandoff(
      readiness,
      input.paymentRail,
      input.signatureProvider,
    ) ||
    !readiness.approvedVersions.msa ||
    !readiness.approvedVersions.serviceQuote ||
    !readiness.legalIdentity
  ) {
    throw new EnrollmentNotReadyError(
      "The enrollment handoff is safely paused until legal and delivery setup is complete.",
      readiness,
    );
  }

  const snapshot = buildEnrollmentDocumentSnapshot({
    presentation: input.presentation,
    signer: input.signer,
    tier: input.tier,
    firstVisitPrice: input.firstVisitPrice,
    recurringVisitPrice: input.recurringVisitPrice,
    annualizedValue: input.annualizedValue,
    salesContext: input.salesContext,
    homeSolicitationNoticeDays: input.homeSolicitationNoticeDays,
    paymentRail: input.paymentRail,
  });
  const email = normalizeEnrollmentEmail(
    snapshot.signer?.email ?? input.presentation.clientEmail,
  )!;
  const recipientGate = getEnrollmentRecipientGate(email);
  if (!recipientGate.allowed) {
    throw new EnrollmentNotReadyError(recipientGate.detail, readiness);
  }
  const supabase = createServiceRoleSupabaseClient();
  const existingResult = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("presentation_id", input.presentation.id)
    .maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);
  let packet = existingResult.data ? asPacket(existingResult.data) : null;

  if (
    packet &&
    packet.signature_provider !== input.signatureProvider &&
    (Boolean(packet.docusign_envelope_id) ||
      (packet.status !== "draft" && packet.status !== "needs_attention"))
  ) {
    throw new Error(
      "The signing method cannot change after the customer handoff begins. Void this packet before preparing a replacement.",
    );
  }

  if (
    packet &&
    packet.status !== "draft" &&
    packet.status !== "needs_attention" &&
    packet.payment_rail !== input.paymentRail
  ) {
    throw new Error(
      "The payment arrangement cannot change after the customer handoff begins. Void this packet before preparing a replacement.",
    );
  }

  if (packet?.status === "voided") {
    throw new Error(
      "This enrollment envelope was voided. Start a replacement packet before sending again.",
    );
  }

  if (packet && packet.status !== "needs_attention" && packet.status !== "draft") {
    return {
      packetId: packet.id,
      status: "signature_sent",
      customerEmail: packet.customer_email,
      envelopeId: packet.docusign_envelope_id,
      reused: true,
    };
  }

  const now = new Date();
  const manualPaymentApprovedAt =
    input.paymentRail === "manual_cash_check" ? now.toISOString() : null;
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
    payment_rail: input.paymentRail,
    signature_provider: input.signatureProvider,
    manual_payment_approved_at: manualPaymentApprovedAt,
    manual_payment_approved_by:
      input.paymentRail === "manual_cash_check" ? input.actor : null,
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
      actor: input.actor,
      eventData: {
        presentationId: input.presentation.id,
        msaVersion: readiness.approvedVersions.msa.version,
        serviceAgreementVersion: readiness.approvedVersions.serviceQuote.version,
        paymentRail: input.paymentRail,
        manualPaymentApprovedAt,
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
      actor: input.actor,
      eventData: { paymentRail: input.paymentRail },
    });
  }

  let envelopeId = packet.docusign_envelope_id;
  const envelopeWasAlreadySent = packet.docusign_status === "sent";
  if (input.signatureProvider === "docusign" && !envelopeId) {
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

  const deliveryEmail = normalizeEnrollmentEmail(
    packet.document_snapshot.signer?.email ?? packet.customer_email,
  );
  if (!deliveryEmail) {
    throw new Error("The saved agreement signer does not have a valid email address.");
  }
  const savedRecipientGate = getEnrollmentRecipientGate(deliveryEmail);
  if (!savedRecipientGate.allowed) {
    throw new EnrollmentNotReadyError(savedRecipientGate.detail, readiness);
  }

  const tokenExpiresAt = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const tokenSha256 = enrollmentTokenSha256(rawToken);
  const rotateToken = await supabase
    .from("enrollment_packets")
    .update({
      public_token_sha256: tokenSha256,
      public_token_expires_at: tokenExpiresAt,
    })
    .eq("id", packet.id);
  if (rotateToken.error) {
    throw new Error(`The private agreement link could not be secured: ${rotateToken.error.message}`);
  }

  try {
    if (
      input.signatureProvider === "docusign" &&
      !envelopeWasAlreadySent &&
      envelopeId
    ) {
      await sendCreatedDocuSignEnvelope({ envelopeId });
      const markEnvelopeSent = await supabase
        .from("enrollment_packets")
        .update({ docusign_status: "sent" })
        .eq("id", packet.id);
      if (markEnvelopeSent.error) {
        throw new Error(markEnvelopeSent.error.message);
      }
      await recordPacketEvent({
        packetId: packet.id,
        eventType: "docusign_envelope_sent",
        actor: "homeatlas_server",
        provider: "docusign",
        providerEventKey: `envelope:${envelopeId}:sent`,
        eventData: { envelopeId },
      });
    }
  } catch (error) {
    await flagPacketError(packet.id, "docusign_send_failed", error);
    throw error;
  }

  const enrollmentUrl = `${resolvePublicAppOrigin()}/enroll/${encodeURIComponent(rawToken)}`;
  const invitation = buildSignatureInvitationEmail({
    snapshot: packet.document_snapshot,
    enrollmentUrl,
    signatureProvider: input.signatureProvider,
  });
  const emailResult = await sendResendEmail({
    to: deliveryEmail,
    replyTo: readiness.legalIdentity.noticeEmail,
    subject: invitation.subject,
    html: invitation.html,
    text: invitation.text,
    idempotencyKey: `enrollment-signature-${packet.id}-${tokenSha256.slice(0, 16)}`,
  });
  if (!emailResult.ok) {
    const error = new Error(`The agreement email was not accepted: ${emailResult.errorCode}`);
    await flagPacketError(packet.id, "resend_signature_invitation_failed", error, "resend");
    throw error;
  }

  const sentAt = new Date().toISOString();
  const markSent = await supabase
    .from("enrollment_packets")
    .update({
      status: "signature_sent",
      docusign_status:
        input.signatureProvider === "docusign" ? "sent" : null,
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
    provider: "resend",
    providerEventKey: `email:${emailResult.providerMessageId}`,
    eventData: { recipient: deliveryEmail, sentAt },
  });

  return {
    packetId: packet.id,
    status: "signature_sent",
    customerEmail: deliveryEmail,
    envelopeId,
    reused: false,
  };
}
