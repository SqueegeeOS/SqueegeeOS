import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  CustomerAftercareActionError,
  recordCustomerAftercareOutcome,
} from "@/lib/aftercare/customer-aftercare-actions-server";
import { loadCustomerAftercareSnapshot } from "@/lib/aftercare/customer-aftercare-server";
import type { CustomerAftercareOutcome } from "@/lib/aftercare/customer-aftercare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
};

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: PRIVATE_HEADERS },
  );
}

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  try {
    const snapshot = await loadCustomerAftercareSnapshot();
    return NextResponse.json(snapshot, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("[aftercare] snapshot failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Customer aftercare is not available." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  try {
    const input = (await request.json()) as {
      taskKey?: string;
      outcome?: CustomerAftercareOutcome;
      note?: string | null;
    };
    const result = await recordCustomerAftercareOutcome({
      taskKey: input.taskKey ?? "",
      outcome: input.outcome as CustomerAftercareOutcome,
      note: input.note,
    });
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof CustomerAftercareActionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: PRIVATE_HEADERS },
      );
    }
    console.error("[aftercare] resolution failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Customer aftercare could not be saved." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
