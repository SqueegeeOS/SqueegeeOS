import { NextRequest, NextResponse } from "next/server";
import {
  createPresentation,
  findAuthoritativePresentationForSalesLead,
  listPresentations,
  patchPresentation,
} from "@/lib/presentations/repository";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  resolvePresentationSalesLineage,
  markSalesLeadPresentationCreated,
  SalesWorkspaceActionError,
  SalesWorkspaceUnavailableError,
} from "@/lib/sales/workspace-server";

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!authorizeAdminRequest(req.headers)) {
    return unauthorized();
  }

  try {
    const presentations = await listPresentations();
    return NextResponse.json({ presentations });
  } catch (error) {
    console.error("[presentations] list error:", error);
    return NextResponse.json(
      { error: "Failed to list presentations" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!authorizeAdminRequest(req.headers)) {
    return unauthorized();
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedRepSlug =
      typeof body.repSlug === "string" ? body.repSlug.trim().toLowerCase() : "";
    const requestedCreator =
      typeof body.createdBy === "string" && body.createdBy.trim()
        ? body.createdBy.trim().slice(0, 120)
        : "Team";
    const requestedLeadId =
      typeof body.salesRepLeadId === "string" && body.salesRepLeadId.trim()
        ? body.salesRepLeadId.trim()
        : null;
    if (requestedLeadId && !UUID_PATTERN.test(requestedLeadId)) {
      return NextResponse.json(
        { error: "Lead reference is invalid." },
        { status: 400 },
      );
    }
    const lineage = requestedRepSlug
      ? await resolvePresentationSalesLineage(requestedRepSlug, requestedLeadId)
      : null;
    if (!lineage && requestedLeadId) {
      return NextResponse.json(
        { error: "A sales representative is required for that lead." },
        { status: 400 },
      );
    }
    const existingPresentation = lineage?.leadId
      ? await findAuthoritativePresentationForSalesLead({
          salesRepId: lineage.id,
          salesRepLeadId: lineage.leadId,
        })
      : null;
    const presentation =
      existingPresentation ??
      (await createPresentation({
        clientName: lineage?.lead?.fullName || body.clientName,
        clientAddress: lineage?.lead?.propertyAddress,
        clientPhone: lineage?.lead?.phone ?? undefined,
        clientEmail: lineage?.lead?.email ?? undefined,
        // The creator label remains useful for trusted HQ flows such as the care
        // plan builder. Only the stable, server-resolved rep ID grants sales
        // attribution; this display label never does.
        createdBy: lineage?.displayName ?? requestedCreator,
        salesRepId: lineage?.id ?? null,
        salesRepLeadId: lineage?.leadId ?? null,
        tier: body.tier,
        homeSqft:
          typeof body.homeSqft === "number" ? body.homeSqft : undefined,
        quoteSnapshot: body.quoteSnapshot ?? null,
      }));

    if (lineage?.leadId && presentation.status !== "signed") {
      try {
        await markSalesLeadPresentationCreated({
          repId: lineage.id,
          leadId: lineage.leadId,
        });
      } catch (trackingError) {
        console.error(
          "[presentations] nonfatal sales lead stage update failed",
          trackingError,
        );
      }
    }

    if (
      !existingPresentation &&
      body.quoteSnapshot?.windowCareVisitPrice > 0
    ) {
      const patched = await patchPresentation(presentation.id, {
        monthlyRate: body.quoteSnapshot.windowCareVisitPrice,
        tier:
          body.quoteSnapshot.frequency === "quarterly"
            ? "quarterly"
            : "biannual",
      });
      return NextResponse.json(
        { presentation: patched ?? presentation, resumed: false },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { presentation, resumed: Boolean(existingPresentation) },
      { status: existingPresentation ? 200 : 201 },
    );
  } catch (error) {
    if (
      error instanceof SalesWorkspaceActionError ||
      error instanceof SalesWorkspaceUnavailableError
    ) {
      const status =
        error instanceof SalesWorkspaceActionError ? error.status : 503;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[presentations] create error:", error);
    return NextResponse.json(
      { error: "Failed to create presentation" },
      { status: 500 },
    );
  }
}
