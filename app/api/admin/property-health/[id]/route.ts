import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { listStaffAssessments } from "@/lib/health/assessment-repository";
import {
  getPropertyHealthHeader,
  listStaffHealthChecks,
} from "@/lib/health/repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authHeaders = request.headers;
  if (!authorizeAdminRequest(authHeaders)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const [property, assessments, legacyChecks] = await Promise.all([
      getPropertyHealthHeader(id),
      listStaffAssessments(id),
      listStaffHealthChecks(id),
    ]);

    return NextResponse.json({ property, assessments, legacyChecks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load property health";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
