import { NextResponse } from "next/server";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import { isJobAddonAssignmentId, validateTechnicianJobAddonRequest } from "@/lib/field-operations/technician-job-addon";
import { listTechnicianJobAddons, recordTechnicianJobAddon } from "@/lib/field-operations/technician-job-addon-server";

export const runtime = "nodejs";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Add-on log is unavailable.";
  const status = /not assigned|not available|outside the safe|no longer active|needs a HomeAtlas/i.test(message) ? 403
    : /already used/i.test(message) ? 409 : 503;
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor || actor.kind !== "technician") return NextResponse.json({ error: "Technician Field Pass required" }, { status: 401 });
  const assignmentId = new URL(request.url).searchParams.get("assignmentId");
  if (!isJobAddonAssignmentId(assignmentId)) return NextResponse.json({ error: "Choose an assigned job." }, { status: 400 });
  try {
    const reports = await listTechnicianJobAddons(actor, assignmentId);
    return NextResponse.json({ reports }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor || actor.kind !== "technician") return NextResponse.json({ error: "Technician Field Pass required" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Enter the add-on details." }, { status: 400 }); }
  const input = validateTechnicianJobAddonRequest(body);
  if (!input) return NextResponse.json({ error: "Enter a service and a price between $0.01 and $10,000." }, { status: 400 });
  try {
    const result = await recordTechnicianJobAddon(actor, input);
    return NextResponse.json(result, { status: result.replayed ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
