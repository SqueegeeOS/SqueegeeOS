import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  createSalesActivity,
  createSalesLead,
  loadSalesWorkspace,
  SalesWorkspaceUnavailableError,
} from "@/lib/sales/workspace-server";
import type { SalesWorkspaceCommand } from "@/lib/sales/workspace-types";
import {
  validateCreateSalesActivity,
  validateCreateSalesLead,
} from "@/lib/sales/workspace-validation";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function workspaceError(error: unknown) {
  if (error instanceof SalesWorkspaceUnavailableError) {
    const status = error.message.includes("not active") ? 404 : 503;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error("[sales-workspace] unexpected error", error);
  return NextResponse.json(
    { error: "The private sales workspace could not complete that request." },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repSlug: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  const { repSlug } = await params;

  try {
    const workspace = await loadSalesWorkspace(repSlug);
    return NextResponse.json(workspace, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return workspaceError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ repSlug: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  const { repSlug } = await params;

  let command: SalesWorkspaceCommand;
  try {
    command = (await request.json()) as SalesWorkspaceCommand;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    if (command?.kind === "lead") {
      const validation = validateCreateSalesLead(command.lead);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const lead = await createSalesLead(repSlug, validation.value);
      return NextResponse.json(
        { lead, message: "Homeowner saved to the private follow-up queue." },
        { status: 201 },
      );
    }

    if (command?.kind === "activity") {
      const validation = validateCreateSalesActivity(command.activity);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      await createSalesActivity(repSlug, validation.value);
      return NextResponse.json(
        { message: "Field activity recorded." },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { error: "Choose a supported sales workspace action." },
      { status: 400 },
    );
  } catch (error) {
    return workspaceError(error);
  }
}
