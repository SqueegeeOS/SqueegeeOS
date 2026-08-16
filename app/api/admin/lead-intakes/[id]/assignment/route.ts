import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { validateLeadIntakeAssignment } from "@/lib/sales/lead-intake-assignment";
import {
  assignLeadIntakeToSalesRep,
  LeadIntakeAssignmentError,
  loadActiveLeadAssignmentReps,
  loadLeadIntakeSalesAssignment,
} from "@/lib/sales/lead-intake-assignment-server";

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function assignmentError(error: unknown) {
  if (error instanceof LeadIntakeAssignmentError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[lead-assignment] unexpected error", error);
  return NextResponse.json(
    { error: "HomeAtlas could not complete that assignment." },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid request reference." }, { status: 400 });
  }
  try {
    const [assignment, salesReps] = await Promise.all([
      loadLeadIntakeSalesAssignment(id),
      loadActiveLeadAssignmentReps(),
    ]);
    return NextResponse.json({ assignment, salesReps });
  } catch (error) {
    return assignmentError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid request reference." }, { status: 400 });
  }
  const validation = validateLeadIntakeAssignment(
    await request.json().catch(() => null),
  );
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const assignment = await assignLeadIntakeToSalesRep({
      leadIntakeId: id,
      ...validation.value,
    });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return assignmentError(error);
  }
}
