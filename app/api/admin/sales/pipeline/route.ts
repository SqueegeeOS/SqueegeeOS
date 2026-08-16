import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { loadOwnerSalesPipeline } from "@/lib/sales/owner-pipeline-server";
import {
  SalesWorkspaceActionError,
  SalesWorkspaceUnavailableError,
  updateSalesLead,
} from "@/lib/sales/workspace-server";
import { validateUpdateSalesLead } from "@/lib/sales/workspace-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const REP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function pipelineError(error: unknown) {
  if (error instanceof SalesWorkspaceActionError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof SalesWorkspaceUnavailableError) {
    return json({ error: error.message }, 503);
  }
  console.error("[owner-sales-pipeline] request failed", error);
  return json({ error: "The private sales pipeline could not be loaded." }, 500);
}

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    return json(await loadOwnerSalesPipeline());
  } catch (error) {
    return pipelineError(error);
  }
}

export async function PATCH(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Lead update details are required." }, 400);
  }
  const raw = body as Record<string, unknown>;
  const repSlug =
    typeof raw.repSlug === "string" ? raw.repSlug.trim().toLowerCase() : "";
  if (!REP_SLUG_PATTERN.test(repSlug)) {
    return json({ error: "Sales representative reference is invalid." }, 400);
  }

  const validation = validateUpdateSalesLead(raw.lead);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  try {
    const lead = await updateSalesLead(repSlug, validation.value);
    return json({
      lead,
      message:
        lead.status === "lost"
          ? "Lead closed with the reason preserved."
          : "Owner next move saved. No message or charge was sent.",
    });
  } catch (error) {
    return pipelineError(error);
  }
}
