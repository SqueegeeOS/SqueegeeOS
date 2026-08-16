import { NextRequest, NextResponse } from "next/server";
import {
  getPresentation,
  patchPresentation,
} from "@/lib/presentations/repository";
import type { PresentationData } from "@/lib/presentations/types";
import { authorizeSalesPresentationRequest } from "@/lib/sales/sales-access";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await authorizeSalesPresentationRequest(req.headers, id))) {
    return unauthorized();
  }

  try {
    const presentation = await getPresentation(id);
    if (!presentation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ presentation });
  } catch (error) {
    console.error("[presentations] get error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await authorizeSalesPresentationRequest(req.headers, id))) {
    return unauthorized();
  }

  try {
    const body = (await req.json()) as Partial<PresentationData>;
    // Sales ownership is assigned only while creating the presentation from a
    // server-resolved rep slug; ordinary editor saves cannot reassign it.
    const editableBody = { ...body };
    delete editableBody.id;
    delete editableBody.createdBy;
    delete editableBody.salesRepId;
    delete editableBody.salesRepLeadId;
    delete editableBody.leadIntakeId;
    delete editableBody.signedAt;
    delete editableBody.agreementId;
    delete editableBody.homeownerId;
    delete editableBody.propertyId;
    delete editableBody.membershipId;
    delete editableBody.onboardingStatus;
    delete editableBody.createdAt;
    delete editableBody.updatedAt;
    if (editableBody.status !== "presented") delete editableBody.status;
    const presentation = await patchPresentation(id, editableBody);
    if (!presentation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ presentation });
  } catch (error) {
    console.error("[presentations] patch error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
