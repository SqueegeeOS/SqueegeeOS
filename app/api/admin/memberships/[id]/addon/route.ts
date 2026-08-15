import { NextResponse } from "next/server";
import {
  recordMemberAddonService,
  validateRecordMemberAddonInput,
  type RecordMemberAddonInput,
} from "@/lib/admin/record-member-addon-service";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import type { MemberAddonStatus } from "@/lib/persistence/types/member-addon";
import { createMemberAddonCheckout } from "@/lib/billing/member-addon-checkout";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authHeaders = request.headers;
  if (!authorizeAdminRequest(authHeaders)) {
    return unauthorized();
  }

  const { id } = await context.params;

  let body: Omit<RecordMemberAddonInput, "membershipId"> & {
    collectionMode?: "record_only" | "stripe_checkout";
  };
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

  if (
    body.collectionMode !== undefined &&
    body.collectionMode !== "record_only" &&
    body.collectionMode !== "stripe_checkout"
  ) {
    return NextResponse.json(
      { error: "Collection mode is invalid" },
      { status: 400 },
    );
  }

  const validationError = validateRecordMemberAddonInput(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    if (body.collectionMode === "stripe_checkout") {
      const checkout = await createMemberAddonCheckout({
        addon: {
          membershipId: input.membershipId,
          serviceName: input.serviceName,
          serviceDate: input.serviceDate,
          retailPrice: input.retailPrice,
          discountPercent: input.discountPercent,
          amountCharged: input.amountCharged,
          notes: input.notes,
        },
        requestOrigin: request.headers.get("origin"),
      });
      return NextResponse.json({
        ...checkout,
        message: checkout.reused
          ? "Existing customer payment link reopened."
          : "Customer-approved Stripe payment link created.",
      });
    }
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
        : message.includes("already paid") ||
            message.includes("already exist") ||
            message.includes("attempt limit")
          ? 409
        : message.includes("does not exist")
          ? 503
          : 500;
    console.error("[memberships/addon] failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
