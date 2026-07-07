import { NextResponse } from "next/server";
import type { CustomerWorkspaceRefType } from "@/lib/hq/customer-workspace/types";
import { loadCustomerWorkspace } from "@/lib/hq/customer-workspace/load-workspace";
import {
  updateHomeownerFields,
  updateLeadIntakeFields,
  updatePresentationNotes,
  updatePropertyFields,
} from "@/lib/hq/customer-workspace/update-workspace";
import { authorizeAdminRequest } from "@/lib/admin/pin";

const TYPES: CustomerWorkspaceRefType[] = [
  "lead",
  "presentation",
  "property",
  "closed-job",
];

function isRefType(value: string): value is CustomerWorkspaceRefType {
  return TYPES.includes(value as CustomerWorkspaceRefType);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ type: string; id: string }> },
) {
  const pinHeader = _request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, id } = await context.params;
  if (!isRefType(type)) {
    return NextResponse.json({ error: "Invalid workspace type" }, { status: 400 });
  }

  try {
    const workspace = await loadCustomerWorkspace(type, id);
    if (!workspace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ workspace });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ type: string; id: string }> },
) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, id } = await context.params;
  if (!isRefType(type)) {
    return NextResponse.json({ error: "Invalid workspace type" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (type === "lead") {
      await updateLeadIntakeFields(id, {
        name: typeof body.name === "string" ? body.name : undefined,
        phone: typeof body.phone === "string" ? body.phone : undefined,
        email: typeof body.email === "string" ? body.email : undefined,
        serviceAddress:
          typeof body.serviceAddress === "string" ? body.serviceAddress : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        status:
          body.status === "new" ||
          body.status === "contacted" ||
          body.status === "scheduled" ||
          body.status === "archived"
            ? body.status
            : undefined,
      });
    }

    if (type === "property") {
      if (typeof body.homeownerId === "string") {
        await updateHomeownerFields(body.homeownerId, {
          fullName: typeof body.fullName === "string" ? body.fullName : undefined,
          email:
            typeof body.email === "string" || body.email === null
              ? (body.email as string | null)
              : undefined,
          phone:
            typeof body.phone === "string" || body.phone === null
              ? (body.phone as string | null)
              : undefined,
        });
      }
      await updatePropertyFields(id, {
        name: typeof body.propertyName === "string" ? body.propertyName : undefined,
        address: typeof body.address === "string" ? body.address : undefined,
        city: typeof body.city === "string" ? body.city : undefined,
        state: typeof body.state === "string" ? body.state : undefined,
        zip: typeof body.zip === "string" ? body.zip : undefined,
        squareFeet:
          typeof body.squareFeet === "number" ? body.squareFeet : undefined,
      });
    }

    if (type === "presentation" && typeof body.customNotes === "string") {
      await updatePresentationNotes(id, body.customNotes);
    }

    const workspace = await loadCustomerWorkspace(type, id);
    if (!workspace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ workspace });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
