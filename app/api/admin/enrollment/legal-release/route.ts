import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { getEnrollmentLegalReviewPacket } from "@/lib/enrollment/legal-review-packet";
import { probeDocuSignEnrollmentTemplate } from "@/lib/integrations/docusign";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ReleasedAgreementRow {
  document_kind: string;
  version: string;
  content_sha256: string;
  release_authority: string | null;
  counsel_review_status: string;
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      msaSha256?: unknown;
      serviceSha256?: unknown;
    } | null;
    const expectedMsaSha256 =
      typeof body?.msaSha256 === "string" ? body.msaSha256.trim() : "";
    const expectedServiceSha256 =
      typeof body?.serviceSha256 === "string"
        ? body.serviceSha256.trim()
        : "";
    if (
      !/^[0-9a-f]{64}$/.test(expectedMsaSha256) ||
      !/^[0-9a-f]{64}$/.test(expectedServiceSha256)
    ) {
      return NextResponse.json(
        { error: "Run the read-only provider check and review both exact fingerprints first." },
        { status: 400 },
      );
    }
    const probe = await probeDocuSignEnrollmentTemplate();
    if (!probe.ok) {
      return NextResponse.json(
        {
          error:
            "The exact DocuSign MSA and Service & Quote files must pass the read-only probe before owner release.",
          probe,
        },
        { status: 409 },
      );
    }
    const msaFile = probe.documents.find(
      (document) => document.documentKind === "master_service_agreement",
    );
    const serviceFile = probe.documents.find(
      (document) => document.documentKind === "service_quote_agreement",
    );
    if (!msaFile || !serviceFile) {
      return NextResponse.json(
        { error: "DocuSign did not expose one unambiguous MSA and Service & Quote file." },
        { status: 409 },
      );
    }
    if (
      msaFile.sha256 !== expectedMsaSha256 ||
      serviceFile.sha256 !== expectedServiceSha256
    ) {
      return NextResponse.json(
        {
          error:
            "A DocuSign file changed after the visible check. Review the new fingerprints before release.",
          probe,
        },
        { status: 409 },
      );
    }

    const reviewPacket = getEnrollmentLegalReviewPacket();
    const msaReview = reviewPacket.documents.find(
      (document) => document.id === "master_service_agreement",
    );
    const serviceReview = reviewPacket.documents.find(
      (document) => document.id === "service_quote_agreement",
    );
    if (!msaReview || !serviceReview) {
      throw new Error("The internal release candidates did not load.");
    }

    const supabase = createServiceRoleSupabaseClient();
    const versions = await supabase
      .from("agreement_document_versions")
      .select("document_kind, version, review_copy_sha256")
      .in("document_kind", [
        "master_service_agreement",
        "service_quote_agreement",
      ])
      .in("version", [msaReview.version, serviceReview.version]);
    if (versions.error) throw new Error(versions.error.message);
    const versionRows = versions.data ?? [];
    const msaRow = versionRows.find(
      (row) => row.document_kind === "master_service_agreement",
    );
    const serviceRow = versionRows.find(
      (row) => row.document_kind === "service_quote_agreement",
    );
    if (
      msaRow?.review_copy_sha256 !== msaReview.integrity.sha256 ||
      serviceRow?.review_copy_sha256 !== serviceReview.integrity.sha256
    ) {
      return NextResponse.json(
        {
          error:
            "The internal release candidate changed or is not fingerprint-bound. Create a new version before release.",
        },
        { status: 409 },
      );
    }

    const released = await supabase.rpc("release_enrollment_agreement_pair", {
      p_msa_version: msaReview.version,
      p_msa_content_sha256: msaFile.sha256,
      p_service_version: serviceReview.version,
      p_service_content_sha256: serviceFile.sha256,
      p_actor: "homeatlas_owner",
    });
    if (released.error) throw new Error(released.error.message);

    return NextResponse.json(
      {
        released: ((released.data ?? []) as ReleasedAgreementRow[]).map((row) => ({
          documentKind: row.document_kind,
          version: row.version,
          contentSha256: row.content_sha256,
          releaseAuthority: row.release_authority,
          counselReviewStatus: row.counsel_review_status,
        })),
        message:
          "The owner released the exact DocuSign files. Counsel review remains recorded as pending and can produce a later version.",
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The exact agreement files could not be owner-released.";
    console.error("[enrollment-legal-release] failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
