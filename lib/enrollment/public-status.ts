import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { buildPortalAccessUrl } from "@/lib/membership/portal-access";
import { enrollmentTokenSha256, isPlausibleEnrollmentToken } from "./token";
import type {
  EnrollmentDocumentSnapshot,
  EnrollmentPacketRow,
  EnrollmentPacketStatus,
} from "./types";
import {
  normalizePaymentRail,
  type PaymentRail,
} from "@/lib/billing/payment-rail";

export interface PublicEnrollmentStatus {
  customerFirstName: string;
  maskedEmail: string;
  propertyAddress: string;
  planName: string;
  cadence: string;
  firstVisitPriceCents: number;
  recurringVisitPriceCents: number;
  paymentRail: PaymentRail;
  status: EnrollmentPacketStatus;
  agreementComplete: boolean;
  paymentComplete: boolean;
  paymentUrl: string | null;
  paymentUrlExpiresAt: string | null;
  portalUrl: string | null;
  needsHelp: boolean;
  updatedAt: string;
}
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your email";
  return `${local.slice(0, 1)}${"•".repeat(Math.min(5, Math.max(2, local.length - 1)))}@${domain}`;
}

export async function loadPublicEnrollmentStatus(
  token: string,
): Promise<PublicEnrollmentStatus | null> {
  if (!isPlausibleEnrollmentToken(token)) return null;
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("public_token_sha256", enrollmentTokenSha256(token))
    .maybeSingle();
  if (result.error || !result.data) return null;
  const packet = result.data as EnrollmentPacketRow;
  const paymentRail = normalizePaymentRail(packet.payment_rail);
  if (new Date(packet.public_token_expires_at).getTime() <= Date.now()) return null;
  const snapshot = packet.document_snapshot as EnrollmentDocumentSnapshot;
  let portalUrl: string | null = null;
  if (packet.status === "portal_ready" && packet.membership_id) {
    const membership = await supabase
      .from("memberships")
      .select("portal_access_token")
      .eq("id", packet.membership_id)
      .maybeSingle();
    if (membership.data?.portal_access_token) {
      portalUrl = buildPortalAccessUrl(
        membership.data.portal_access_token as string,
      );
    }
  }
  const paymentUrlOpen = Boolean(
    packet.stripe_payment_url &&
      packet.stripe_payment_url_expires_at &&
      new Date(packet.stripe_payment_url_expires_at).getTime() > Date.now() &&
      !packet.payment_completed_at,
  );
  const agreementComplete = Boolean(
    packet.signed_at ||
      [
        "signature_complete",
        "payment_ready",
        "payment_sent",
        "payment_complete",
        "portal_ready",
      ].includes(packet.status),
  );
  const paymentComplete = Boolean(
    packet.payment_completed_at ||
      packet.status === "payment_complete" ||
      packet.status === "portal_ready",
  );
  return {
    customerFirstName: firstName(packet.customer_name),
    maskedEmail: maskEmail(packet.customer_email),
    propertyAddress: snapshot.property.fullAddress,
    planName: snapshot.plan.tierLabel,
    cadence: snapshot.plan.cadence,
    firstVisitPriceCents: packet.first_visit_price_cents,
    recurringVisitPriceCents: packet.recurring_visit_price_cents,
    paymentRail,
    status: packet.status,
    agreementComplete,
    paymentComplete,
    paymentUrl: paymentUrlOpen ? packet.stripe_payment_url : null,
    paymentUrlExpiresAt: paymentUrlOpen
      ? packet.stripe_payment_url_expires_at
      : null,
    portalUrl,
    needsHelp:
      packet.status === "needs_attention" || Boolean(packet.last_error_code),
    updatedAt: packet.updated_at,
  };
}
