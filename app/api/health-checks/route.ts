import { NextResponse } from "next/server";
import {
  createPropertyHealthCheck,
  listCustomerHealthChecks,
  listStaffHealthChecks,
  validateHealthCheckForm,
} from "@/lib/health/repository";
import type { HealthCheckFormState } from "@/lib/health/types";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Partial<HealthCheckFormState>;

    const validationError = validateHealthCheckForm(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const result = await createPropertyHealthCheck(body as HealthCheckFormState);

    return NextResponse.json(
      { success: true, id: result.check.id, storage: result.storage },
      { status: 201 },
    );
  } catch (error) {
    console.error("[health-checks POST]", error);
    return NextResponse.json(
      { error: "Failed to save health check" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const view = searchParams.get("view") ?? "customer";

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId is required" },
        { status: 400 },
      );
    }

    if (view === "staff") {
      const checks = await listStaffHealthChecks(propertyId);
      return NextResponse.json({ checks });
    }

    const checks = await listCustomerHealthChecks(propertyId);
    return NextResponse.json({ checks });
  } catch (error) {
    console.error("[health-checks GET]", error);
    return NextResponse.json(
      { error: "Failed to load health checks" },
      { status: 500 },
    );
  }
}
