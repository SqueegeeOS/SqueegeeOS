import { NextRequest, NextResponse } from "next/server";
import {
  createPresentation,
  findAuthoritativePresentationForLeadIntake,
  findAuthoritativePresentationForSalesLead,
  listPresentations,
  patchPresentation,
} from "@/lib/presentations/repository";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  authorizeSalesRequest,
  canSalesActorAccessRep,
} from "@/lib/sales/sales-access";
import {
  getLeadIntakeById,
  updateLeadIntakeStatus,
} from "@/lib/acquisition/leads/repository";
import {
  resolvePresentationSalesLineage,
  markSalesLeadPresentationCreated,
  SalesWorkspaceActionError,
  SalesWorkspaceUnavailableError,
} from "@/lib/sales/workspace-server";
import {
  LeadIntakeAssignmentError,
  loadLeadIntakeSalesAssignment,
} from "@/lib/sales/lead-intake-assignment-server";

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function leadCreatorLabel(source: "request_form" | "facebook_lead_ad"): string {
  return source === "facebook_lead_ad"
    ? "HQ · Facebook lead"
    : "HQ · Website request";
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
  const actor = await authorizeSalesRequest(req.headers);
  if (!actor) return unauthorized();

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
    const requestedLeadIntakeId =
      typeof body.leadIntakeId === "string" && body.leadIntakeId.trim()
        ? body.leadIntakeId.trim()
        : null;
    if (
      actor.kind === "sales_rep" &&
      (!requestedRepSlug ||
        !canSalesActorAccessRep(actor, requestedRepSlug) ||
        requestedLeadIntakeId)
    ) {
      return NextResponse.json(
        { error: "This phone pass can create only its own field presentations." },
        { status: 403 },
      );
    }
    if (requestedLeadId && !UUID_PATTERN.test(requestedLeadId)) {
      return NextResponse.json(
        { error: "Lead reference is invalid." },
        { status: 400 },
      );
    }
    if (requestedLeadIntakeId && !UUID_PATTERN.test(requestedLeadIntakeId)) {
      return NextResponse.json(
        { error: "Inquiry reference is invalid." },
        { status: 400 },
      );
    }
    let lineage = requestedRepSlug
      ? await resolvePresentationSalesLineage(requestedRepSlug, requestedLeadId)
      : null;
    const lineageLeadIntakeId = lineage?.lead?.leadIntakeId ?? null;
    if (
      requestedLeadIntakeId &&
      lineageLeadIntakeId &&
      requestedLeadIntakeId !== lineageLeadIntakeId
    ) {
      return NextResponse.json(
        { error: "That request does not belong to this sales lead." },
        { status: 400 },
      );
    }
    const effectiveLeadIntakeId =
      requestedLeadIntakeId ?? lineageLeadIntakeId;

    // Customer identity for an inquiry-linked presentation is always resolved
    // from the intake. Browser values and sales snapshots never replace it.
    const leadIntake = effectiveLeadIntakeId
      ? await getLeadIntakeById(effectiveLeadIntakeId)
      : null;
    if (effectiveLeadIntakeId && !leadIntake) {
      return NextResponse.json(
        { error: "Customer inquiry was not found." },
        { status: 404 },
      );
    }
    if (leadIntake?.status === "archived") {
      return NextResponse.json(
        { error: "Restore this archived inquiry before scheduling it." },
        { status: 409 },
      );
    }

    if (!lineage && requestedLeadId) {
      return NextResponse.json(
        { error: "A sales representative is required for that lead." },
        { status: 400 },
      );
    }
    const existingPresentation = leadIntake
      ? await findAuthoritativePresentationForLeadIntake({
          leadIntakeId: leadIntake.id,
        })
      : lineage?.leadId
        ? await findAuthoritativePresentationForSalesLead({
            salesRepId: lineage.id,
            salesRepLeadId: lineage.leadId,
          })
        : null;

    if (leadIntake) {
      const assignment = await loadLeadIntakeSalesAssignment(leadIntake.id);
      if (assignment) {
        if (
          lineage &&
          (lineage.id !== assignment.repId ||
            lineage.leadId !== assignment.salesRepLeadId)
        ) {
          return NextResponse.json(
            { error: "That request is assigned to a different sales workspace." },
            { status: 409 },
          );
        }
        if (!lineage) {
          lineage = await resolvePresentationSalesLineage(
            assignment.repSlug,
            assignment.salesRepLeadId,
          );
        }
      } else if (!existingPresentation) {
        return NextResponse.json(
          { error: "Assign an owner and future next action before scheduling." },
          { status: 409 },
        );
      }
      if (
        actor.kind === "sales_rep" &&
        (!lineage || !canSalesActorAccessRep(actor, lineage.slug))
      ) {
        return NextResponse.json(
          { error: "This request is not assigned to your sales workspace." },
          { status: 403 },
        );
      }
    }
    let presentation = existingPresentation;
    let resumed = Boolean(existingPresentation);

    if (!presentation) {
      try {
        presentation = await createPresentation({
          clientName:
            leadIntake?.name || lineage?.lead?.fullName || body.clientName,
          clientAddress:
            leadIntake?.serviceAddress ?? lineage?.lead?.propertyAddress,
          clientPhone: leadIntake?.phone ?? lineage?.lead?.phone ?? undefined,
          clientEmail: leadIntake?.email ?? lineage?.lead?.email ?? undefined,
          // The creator label remains useful for trusted HQ flows such as the
          // care plan builder. Stable server lineage—not this label—owns the
          // customer relationship and any sales attribution.
          createdBy: leadIntake
            ? leadCreatorLabel(leadIntake.source)
            : (lineage?.displayName ?? requestedCreator),
          salesRepId: lineage?.id ?? null,
          // Inquiry and field-lead origins are mutually exclusive at the
          // database layer. The assignment is recovered through lead_intake_id.
          salesRepLeadId: leadIntake ? null : (lineage?.leadId ?? null),
          leadIntakeId: leadIntake?.id ?? null,
          tier: leadIntake?.membershipTier ?? body.tier,
          homeSqft:
            leadIntake?.squareFootage ??
            (typeof body.homeSqft === "number" ? body.homeSqft : undefined),
          quoteSnapshot: leadIntake ? null : (body.quoteSnapshot ?? null),
        });
      } catch (creationError) {
        // A second tab can win the unique-index race after our initial lookup.
        // Re-read the authoritative record instead of surfacing a false failure
        // or ever manufacturing a duplicate.
        const racedPresentation = leadIntake
          ? await findAuthoritativePresentationForLeadIntake({
              leadIntakeId: leadIntake.id,
            })
          : lineage?.leadId
            ? await findAuthoritativePresentationForSalesLead({
                salesRepId: lineage.id,
                salesRepLeadId: lineage.leadId,
              })
            : null;
        if (!racedPresentation) throw creationError;
        presentation = racedPresentation;
        resumed = true;
      }
    }

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

    let leadStatusSynced = true;
    if (leadIntake && leadIntake.status !== "scheduled") {
      try {
        const updatedLead = await updateLeadIntakeStatus(
          leadIntake.id,
          "scheduled",
        );
        leadStatusSynced = updatedLead?.status === "scheduled";
        if (!leadStatusSynced) {
          console.error(
            "[presentations] inquiry presentation saved but status did not update",
            { leadIntakeId: leadIntake.id, presentationId: presentation.id },
          );
        }
      } catch (trackingError) {
        leadStatusSynced = false;
        console.error(
          "[presentations] inquiry presentation saved but status update failed",
          trackingError,
        );
      }
    }

    if (!leadIntake && !resumed && body.quoteSnapshot?.windowCareVisitPrice > 0) {
      const patched = await patchPresentation(presentation.id, {
        monthlyRate: body.quoteSnapshot.windowCareVisitPrice,
        tier:
          body.quoteSnapshot.frequency === "quarterly"
            ? "quarterly"
            : "biannual",
      });
      return NextResponse.json(
        {
          presentation: patched ?? presentation,
          resumed: false,
          leadStatusSynced,
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { presentation, resumed, leadStatusSynced },
      { status: resumed ? 200 : 201 },
    );
  } catch (error) {
    if (
      error instanceof SalesWorkspaceActionError ||
      error instanceof SalesWorkspaceUnavailableError ||
      error instanceof LeadIntakeAssignmentError
    ) {
      const status =
        error instanceof SalesWorkspaceActionError ||
        error instanceof LeadIntakeAssignmentError
          ? error.status
          : 503;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[presentations] create error:", error);
    return NextResponse.json(
      { error: "Failed to create presentation" },
      { status: 500 },
    );
  }
}
