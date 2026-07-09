import { NextResponse } from "next/server";
import {
  recordManualBillingCharge,
  validateRecordManualBillingChargeInput,
  type RecordManualBillingChargeInput,
} from "@/lib/admin/record-manual-billing-charge";
import { authorizeAdminRequest } from "@/lib/admin/pin";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return unauthorized();
  }

  let body: RecordManualBillingChargeInput;
  try {
    body = (await request.json()) as RecordManualBillingChargeInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validationError = validateRecordManualBillingChargeInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await recordManualBillingCharge(body);
    return NextResponse.json({
      ...result,
      message: "Manual charge recorded.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record manual charge";
    const status = message.includes("already has a recorded charge")
      ? 409
      : 500;
    console.error("[billing-charges] record failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
