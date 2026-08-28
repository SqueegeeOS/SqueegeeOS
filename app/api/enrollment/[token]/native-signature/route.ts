import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  enrollmentTokenSha256,
  isPlausibleEnrollmentToken,
} from "@/lib/enrollment/token";
import type { EnrollmentPacketRow } from "@/lib/enrollment/types";
import { completeRemoteEnrollmentSignature } from "@/lib/enrollment/complete-remote-signature";
import { completeManualPaymentHandoff } from "@/lib/enrollment/manual-payment-handoff";
import { createEnrollmentStripeHandoff } from "@/lib/enrollment/stripe-handoff";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type PacketWithVersions = EnrollmentPacketRow & {
  msa_version_id: string;
  service_agreement_version_id: string;
};

const MAX_SIGNATURE_DATA_URL_LENGTH = 1_500_000;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function isValidSignature(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 100 &&
    value.length <= MAX_SIGNATURE_DATA_URL_LENGTH &&
    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/i.test(value)
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return response({ error: "This signature must be submitted from its private HomeAtlas page." }, 403);
  }

  const { token } = await params;
  if (!isPlausibleEnrollmentToken(token)) {
    return response({ error: "Enrollment handoff not found." }, 404);
  }

  const body = (await request.json().catch(() => null)) as {
    signatureDataUrl?: unknown;
    consent?: unknown;
  } | null;
  if (body?.consent !== true || !isValidSignature(body.signatureDataUrl)) {
    return response(
      { error: "Please accept the agreement and draw your signature before continuing." },
      400,
    );
  }

  const supabase = createServiceRoleSupabaseClient();
  const packetResult = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("public_token_sha256", enrollmentTokenSha256(token))
    .maybeSingle();
  if (packetResult.error || !packetResult.data) {
    return response({ error: "Enrollment handoff not found." }, 404);
  }
  let packet = packetResult.data as PacketWithVersions;
  if (new Date(packet.public_token_expires_at).getTime() <= Date.now()) {
    return response({ error: "This private agreement link has expired." }, 410);
  }
  if (packet.signature_provider !== "homeatlas_native") {
    return response({ error: "This agreement uses a different signing method." }, 409);
  }
  if (
    packet.signed_agreement_id &&
    packet.membership_id &&
    packet.homeowner_id &&
    packet.property_id
  ) {
    if (packet.status === "portal_ready") {
      return response({ ok: true, status: packet.status, alreadyCompleted: true });
    }
    try {
      if (packet.payment_rail === "manual_cash_check") {
        const handoff = await completeManualPaymentHandoff({
          packet,
          membershipId: packet.membership_id,
        });
        return response({
          ok: true,
          status: "portal_ready",
          portalUrl: handoff.portalUrl,
          alreadyCompleted: true,
        });
      }
      if (
        packet.status !== "payment_sent" &&
        packet.status !== "payment_complete"
      ) {
        await createEnrollmentStripeHandoff({
          packet,
          membershipId: packet.membership_id,
        });
      }
      return response({ ok: true, status: packet.status, alreadyCompleted: true });
    } catch (error) {
      console.error("[native-enrollment-signature] handoff retry failed", {
        packetId: packet.id,
        message: error instanceof Error ? error.message : "unknown",
      });
      return response(
        { error: "Your signature is safe. The next step is being retried by HomeAtlas." },
        503,
      );
    }
  }
  if (packet.status !== "signature_sent") {
    return response(
      {
        error:
          packet.signed_at
            ? "This agreement has already been completed."
            : "This agreement is not available for signing right now.",
      },
      409,
    );
  }

  const signedAt = new Date().toISOString();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || null;

  try {
    const completed = await completeRemoteEnrollmentSignature({
      packet,
      signedAt,
      signatureProvider: "homeatlas_native",
      signatureDataUrl: body.signatureDataUrl,
      ipAddress,
      userAgent: request.headers.get("user-agent"),
    });

    const saveCompletion = await supabase
      .from("enrollment_packets")
      .update({
        status: "signature_complete",
        signed_at: signedAt,
        signed_agreement_id: completed.agreementId,
        membership_id: completed.membershipId,
        homeowner_id: completed.homeownerId,
        property_id: completed.propertyId,
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", packet.id);
    if (saveCompletion.error) throw new Error(saveCompletion.error.message);

    const event = await supabase.from("enrollment_packet_events").insert({
      enrollment_packet_id: packet.id,
      event_type: "signature_complete",
      actor: "customer_homeatlas_signature",
      provider: "homeatlas_native",
      provider_event_key: `native:${packet.id}:completed`,
      event_data: {
        agreementId: completed.agreementId,
        membershipId: completed.membershipId,
        signedAt,
        salesAttribution: completed.salesAttribution,
      },
    });
    if (event.error && event.error.code !== "23505") {
      throw new Error(event.error.message);
    }

    const refreshed = await supabase
      .from("enrollment_packets")
      .select("*")
      .eq("id", packet.id)
      .single();
    if (refreshed.error) throw new Error(refreshed.error.message);
    packet = refreshed.data as PacketWithVersions;

    if (packet.payment_rail === "manual_cash_check") {
      const handoff = await completeManualPaymentHandoff({
        packet,
        membershipId: completed.membershipId,
      });
      return response({
        ok: true,
        status: "portal_ready",
        portalUrl: handoff.portalUrl,
      });
    }

    await createEnrollmentStripeHandoff({
      packet,
      membershipId: completed.membershipId,
    });
    return response({ ok: true, status: "payment_sent" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 2000) : "Unknown signature completion error";
    console.error("[native-enrollment-signature] completion failed", {
      packetId: packet.id,
      message,
    });
    await supabase
      .from("enrollment_packets")
      .update({
        status: "needs_attention",
        last_error_code: "native_signature_completion_failed",
        last_error_message: message,
      })
      .eq("id", packet.id);
    return response(
      {
        error:
          "Your signature could not be safely recorded yet. Nothing was charged; please try again or contact SqueegeeKing.",
      },
      500,
    );
  }
}
