import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { normalizeOwnerDispatchMonth } from "@/lib/field-operations/owner-dispatch";
import { parseHistoryCursor } from "@/lib/field-records/technician-history";
import { loadTechnicianHistory } from "@/lib/field-records/technician-history-server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const params = new URL(request.url).searchParams;
  const month = params.get("month") ?? normalizeOwnerDispatchMonth(null);
  const cursor = params.get("cursor");
  try {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
    parseHistoryCursor(cursor);
  } catch {
    return NextResponse.json({ error: "Choose a valid month or refresh job history." }, { status: 400, headers });
  }
  try {
    return NextResponse.json(await loadTechnicianHistory(month, cursor), { headers });
  } catch {
    return NextResponse.json({ error: "Job history could not be loaded. Try again; no records were changed." }, { status: 503, headers });
  }
}
