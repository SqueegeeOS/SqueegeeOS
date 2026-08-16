import { NextResponse } from "next/server";
import { authorizeSalesRepRequest } from "@/lib/sales/sales-access";
import {
  createSalesActivity,
  createSalesDoorMemory,
  createSalesLead,
  loadSalesDoorAddressHistory,
  loadSalesWorkspace,
  recordSalesLeadInteraction,
  reverseSalesActivity,
  SalesWorkspaceActionError,
  SalesWorkspaceUnavailableError,
  updateSalesLead,
} from "@/lib/sales/workspace-server";
import type { SalesWorkspaceCommand } from "@/lib/sales/workspace-types";
import {
  validateCreateSalesActivity,
  validateCreateSalesDoorMemory,
  validateCreateSalesLead,
  validateRecordSalesLeadInteraction,
  validateUpdateSalesLead,
  validateUndoSalesActivity,
} from "@/lib/sales/workspace-validation";
import {
  normalizeSalesDoorAddress,
  normalizeSalesDoorAddressKey,
} from "@/lib/sales/door-memory";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function workspaceError(error: unknown) {
  if (error instanceof SalesWorkspaceActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
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
  const { repSlug } = await params;
  if (!(await authorizeSalesRepRequest(request.headers, repSlug))) {
    return unauthorized();
  }

  try {
    const requestedAddress = new URL(request.url).searchParams.get("address");
    if (requestedAddress !== null) {
      const propertyAddress = normalizeSalesDoorAddress(
        requestedAddress.slice(0, 260),
      );
      const addressKey = normalizeSalesDoorAddressKey(propertyAddress);
      if (propertyAddress.length < 5 || addressKey.length < 3) {
        return NextResponse.json(
          { error: "Enter enough of the property address to check its history." },
          { status: 400 },
        );
      }
      const history = await loadSalesDoorAddressHistory(repSlug, addressKey);
      return NextResponse.json(
        { history },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
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
  const { repSlug } = await params;
  if (!(await authorizeSalesRepRequest(request.headers, repSlug))) {
    return unauthorized();
  }

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
      const activity = await createSalesActivity(repSlug, validation.value);
      return NextResponse.json(
        { activity, message: "Field activity recorded." },
        { status: 201 },
      );
    }

    if (command?.kind === "door_memory") {
      const validation = validateCreateSalesDoorMemory(command.memory);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const memory = await createSalesDoorMemory(repSlug, validation.value);
      return NextResponse.json(
        {
          memory,
          message: "This address and doorstep outcome are saved to HomeAtlas.",
        },
        { status: 201 },
      );
    }

    if (command?.kind === "update_lead") {
      const validation = validateUpdateSalesLead(command.lead);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const lead = await updateSalesLead(repSlug, validation.value);
      return NextResponse.json({
        lead,
        message:
          lead.status === "lost"
            ? "Lead closed with the reason preserved."
            : "Next move saved to the private action queue.",
      });
    }

    if (command?.kind === "lead_interaction") {
      const validation = validateRecordSalesLeadInteraction(command.interaction);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const receipt = await recordSalesLeadInteraction(
        repSlug,
        "sales_rep",
        validation.value,
      );
      return NextResponse.json({
        ...receipt,
        message: "Outcome recorded. No message, appointment, or charge was sent.",
      });
    }

    if (command?.kind === "undo_activity") {
      const validation = validateUndoSalesActivity(command.activityId);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const reversal = await reverseSalesActivity(
        repSlug,
        validation.value.activityId,
      );
      return NextResponse.json({
        reversal,
        message: "Field activity corrected. The audit record was preserved.",
      });
    }

    return NextResponse.json(
      { error: "Choose a supported sales workspace action." },
      { status: 400 },
    );
  } catch (error) {
    return workspaceError(error);
  }
}
