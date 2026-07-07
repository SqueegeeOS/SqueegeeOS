import { NextResponse } from "next/server";
import {
  getLeadIntakeById,
  updateLeadIntakeStatus,
} from "@/lib/acquisition/leads/repository";
import type { LeadIntakeStatus } from "@/lib/acquisition/lead-record";
import { authorizeAdminRequest } from "@/lib/admin/pin";

const STATUSES: LeadIntakeStatus[] = [
  "new",
  "contacted",
  "scheduled",
  "archived",
];

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const lead = await getLeadIntakeById(id);
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ lead });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load lead intake";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body.status;
  if (!status || !STATUSES.includes(status as LeadIntakeStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const lead = await updateLeadIntakeStatus(id, status as LeadIntakeStatus);
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ lead });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update lead intake";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
