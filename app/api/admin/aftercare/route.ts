import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  CustomerAftercareActionError,
  recordCustomerAftercareOutcome,
} from "@/lib/aftercare/customer-aftercare-actions-server";
import { loadCustomerAftercareSnapshot } from "@/lib/aftercare/customer-aftercare-server";
import type { CustomerAftercareOutcome } from "@/lib/aftercare/customer-aftercare";
import {
  CustomerServiceCaseActionError,
  recordCustomerServiceCaseAction,
} from "@/lib/service-cases/customer-service-case-actions-server";
import type { CustomerServiceCaseAction } from "@/lib/service-cases/customer-service-case";

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
      operation?: "service_case";
      taskKey?: string;
      outcome?: CustomerAftercareOutcome;
      caseId?: string;
      caseAction?: CustomerServiceCaseAction;
      note?: string | null;
    };
    if (input.operation === "service_case") {
      const result = await recordCustomerServiceCaseAction({
        caseId: input.caseId ?? "",
        action: input.caseAction as CustomerServiceCaseAction,
        note: input.note,
      });
      return NextResponse.json(result, { headers: PRIVATE_HEADERS });
    }
    const result = await recordCustomerAftercareOutcome({
      taskKey: input.taskKey ?? "",
      outcome: input.outcome as CustomerAftercareOutcome,
      note: input.note,
    });
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (
      error instanceof CustomerAftercareActionError ||
      error instanceof CustomerServiceCaseActionError
    ) {
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
