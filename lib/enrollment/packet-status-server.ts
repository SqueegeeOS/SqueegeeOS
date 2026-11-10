import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { isEnrollmentPacketStatus } from "./packet-progress";
import type { EnrollmentDocumentSnapshot, EnrollmentPacketStatusSnapshot } from "./types";
import { normalizePaymentRail } from "@/lib/billing/payment-rail";

import { getPresentation } from "@/lib/presentations/repository";
import { computePresentationRates } from "@/lib/presentations/calculations";
import { calculateAnnualFromVisits } from "@/lib/membership/tier-config";

export async function loadEnrollmentPacketStatus(
  presentationId: string,
  includeUnsignedRevision = false,
): Promise<EnrollmentPacketStatusSnapshot | null> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("enrollment_packets")
    .select("status, payment_rail, updated_at, signature_provider, signed_at, signed_agreement_id, native_signature_started_at, public_token_sha256, document_snapshot, sales_context, home_solicitation_notice_days")
    .eq("presentation_id", presentationId)
    .maybeSingle();

  if (result.error) {
    throw new Error("HomeAtlas could not verify the secure handoff status.");
  }
  if (!result.data) return null;
  if (!isEnrollmentPacketStatus(result.data.status)) {
    throw new Error("HomeAtlas received an unknown secure handoff status.");
  }

  let unsignedRevision: EnrollmentPacketStatusSnapshot["unsignedRevision"];
  if (includeUnsignedRevision && result.data.status === "signature_sent" &&
    result.data.signature_provider === "homeatlas_native" &&
    !result.data.signed_at && !result.data.signed_agreement_id && !result.data.native_signature_started_at) {
    const presentation = await getPresentation(presentationId);
    if (presentation && presentation.status !== "signed" && !presentation.agreementId) {
      const rates = computePresentationRates(presentation);
      const recurring = presentation.tier === "biannual" ? rates.biannualVisit
        : presentation.tier === "triannual" ? rates.triannualVisit : rates.quarterlyVisit;
      const custom = presentation.planMode === "custom" && presentation.carePlan.tier === presentation.tier;
      const snapshot = result.data.document_snapshot as EnrollmentDocumentSnapshot;
      unsignedRevision = {
        expectedTokenSha256: result.data.public_token_sha256,
        expectedPresentationUpdatedAt: presentation.updatedAt,
        tier: presentation.tier,
        firstVisitPrice: rates.carePlanPricing?.visits[0]?.total ?? recurring,
        recurringVisitPrice: recurring,
        annualizedValue: custom && rates.carePlanPricing ? rates.annualRate : calculateAnnualFromVisits(presentation.tier, recurring),
        salesContext: result.data.sales_context,
        homeSolicitationNoticeDays: result.data.home_solicitation_notice_days,
        signatureProvider: "homeatlas_native",
        ...(snapshot.signer ? {
          signerName: snapshot.signer.name, signerEmail: snapshot.signer.email, signerPhone: snapshot.signer.phone,
        } : {}),
        recipientEmail: snapshot.signer?.email ?? presentation.clientEmail,
      };
    }
  }
  return {
    ...(unsignedRevision ? { unsignedRevision } : {}),
    status: result.data.status,
    paymentRail: normalizePaymentRail(result.data.payment_rail),
    updatedAt: result.data.updated_at,
  };
}
