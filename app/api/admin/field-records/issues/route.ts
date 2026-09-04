import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { FieldIssue } from "@/lib/field-records/field-closeout-review";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const result = await createServiceRoleSupabaseClient().rpc("list_open_homeatlas_technician_issues");
    if (result.error) throw new Error("Issue lookup failed");
    const rows = result.data ?? [];
    const issues: FieldIssue[] = rows.slice(0, 50).map((row: {
      assignment_id: string; field_record_id: string; client_name: string;
      technician_name: string; visit_date: string; scope_exception: string;
    }) => ({ assignmentId: row.assignment_id, fieldRecordId: row.field_record_id,
      clientName: row.client_name, technicianName: row.technician_name,
      visitDate: row.visit_date, scopeException: row.scope_exception }));
    return NextResponse.json({ issues, hasMore: rows.length > 50 }, { headers });
  } catch {
    return NextResponse.json({ error: "Could not load technician issues. Try again." }, { status: 503, headers });
  }
}
