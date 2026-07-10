import { NextResponse } from "next/server";
import {
  recordMemberAddonService,
  validateRecordMemberAddonInput,
  type RecordMemberAddonInput,
} from "@/lib/admin/record-member-addon-service";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import type { MemberAddonStatus } from "@/lib/persistence/types/member-addon";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return unauthorized();
  }

  const { id } = await context.params;

  let body: Omit<RecordMemberAddonInput, "membershipId">;
  try {
    body = (await request.json()) as Omit<RecordMemberAddonInput, "membershipId">;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input: RecordMemberAddonInput = {
    membershipId: id,
    serviceName: body.serviceName ?? "",
    serviceDate: body.serviceDate ?? "",
    retailPrice: Number(body.retailPrice),
    discountPercent: Number(body.discountPercent),
    amountCharged: Number(body.amountCharged),
    status: (body.status ?? "paid") as MemberAddonStatus,
    notes: body.notes,
  };

  const validationError = validateRecordMemberAddonInput(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await recordMemberAddonService(input);
    return NextResponse.json({
      ...result,
      message: "Add-on service recorded.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record add-on service";
    const status = message.includes("not found")
      ? 404
      : message.includes("Cancelled")
        ? 409
        : message.includes("does not exist")
          ? 503
          : 500;
    console.error("[memberships/addon] failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
