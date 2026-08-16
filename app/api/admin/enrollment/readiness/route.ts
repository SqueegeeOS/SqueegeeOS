import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { getEnrollmentReadiness } from "@/lib/enrollment/readiness";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const readiness = await getEnrollmentReadiness();
  const databaseReady = readiness.checks.find((check) => check.id === "database")?.ready;
  if (!databaseReady) {
    return NextResponse.json({
      readiness,
      documentVersions: [],
      packets: [],
      loadedAt: new Date().toISOString(),
    });
  }
  const supabase = createServiceRoleSupabaseClient();
  const [versions, packets] = await Promise.all([
    supabase
      .from("agreement_document_versions")
      .select(
        "id, document_kind, version, status, approved_at, approved_by, review_notes, updated_at",
      )
      .order("document_kind")
      .order("created_at", { ascending: false }),
    supabase
      .from("enrollment_packets")
      .select(
        "id, presentation_id, customer_name, customer_email, status, docusign_status, signature_sent_at, signed_at, payment_link_sent_at, payment_completed_at, portal_ready_at, last_error_code, last_error_message, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);
  if (versions.error) {
    return NextResponse.json({ error: versions.error.message }, { status: 500 });
  }
  if (packets.error) {
    return NextResponse.json({ error: packets.error.message }, { status: 500 });
  }
  return NextResponse.json({
    readiness,
    documentVersions: versions.data ?? [],
    packets: packets.data ?? [],
    loadedAt: new Date().toISOString(),
  });
}
