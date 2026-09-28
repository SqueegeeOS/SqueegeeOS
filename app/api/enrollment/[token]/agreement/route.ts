import { generateEnrollmentAgreementPreviewPDF } from "@/lib/agreement/generate-signed-pdf";
import {
  parseSignedAgreementStoragePath,
  SIGNED_AGREEMENT_BUCKET,
} from "@/lib/agreement/signed-agreement-storage";
import { enrollmentAgreementPdfInput } from "@/lib/enrollment/agreement-pdf-input";
import { findEnrollmentPacketByToken } from "@/lib/enrollment/packet-token-repository";
import type { EnrollmentDocumentSnapshot } from "@/lib/enrollment/types";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function unavailable() {
  return Response.json(
    { error: "This agreement is not available from this private link." },
    { status: 404, headers: PRIVATE_HEADERS },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const packet = await findEnrollmentPacketByToken(token);
  if (
    !packet ||
    packet.signature_provider !== "homeatlas_native" ||
    packet.status === "voided" ||
    !packet.signature_sent_at ||
    new Date(packet.public_token_expires_at).getTime() <= Date.now()
  ) {
    return unavailable();
  }

  let bytes: Uint8Array;
  const snapshot = packet.document_snapshot as EnrollmentDocumentSnapshot;
  if (packet.signed_at) {
    if (!packet.signed_agreement_id || !packet.membership_id) return unavailable();
    const supabase = createServiceRoleSupabaseClient();
    const agreement = await supabase
      .from("signed_agreements")
      .select("agreement_pdf_url")
      .eq("id", packet.signed_agreement_id)
      .eq("membership_id", packet.membership_id)
      .eq("presentation_id", packet.presentation_id)
      .eq("status", "complete")
      .maybeSingle();
    if (agreement.error || !agreement.data?.agreement_pdf_url) return unavailable();
    const storagePath = parseSignedAgreementStoragePath(
      agreement.data.agreement_pdf_url as string,
    );
    if (!storagePath) return unavailable();
    const downloaded = await supabase.storage
      .from(SIGNED_AGREEMENT_BUCKET)
      .download(storagePath);
    if (downloaded.error || !downloaded.data) return unavailable();
    bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  } else {
    if (packet.status !== "signature_sent") return unavailable();
    bytes = await generateEnrollmentAgreementPreviewPDF({
      ...enrollmentAgreementPdfInput(snapshot),
      signedAt: snapshot.createdAt,
    });
  }

  return new Response(Buffer.from(bytes), {
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="homeatlas-${packet.signed_at ? "signed-" : ""}agreement.pdf"`,
    },
  });
}
