import { NextResponse } from "next/server";
import { resolvePortalAccessByToken } from "@/lib/persistence/queries/portal-access";
import {
  createPortalServiceCase,
  CustomerServiceCaseActionError,
  listPortalServiceCases,
} from "@/lib/service-cases/customer-service-case-actions-server";
import type { CustomerServiceCaseCategory } from "@/lib/service-cases/customer-service-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
};

function unauthorized() {
  return NextResponse.json(
    { error: "This member portal could not be verified." },
    { status: 401, headers: PRIVATE_HEADERS },
  );
}

async function authorizePortalRequest(request: Request) {
  const portalToken = request.headers.get("x-portal-token")?.trim();
  if (!portalToken) return null;
  return resolvePortalAccessByToken(portalToken);
}

export async function GET(request: Request) {
  const access = await authorizePortalRequest(request);
  if (!access) return unauthorized();
  try {
    const serviceCases = await listPortalServiceCases(access);
    return NextResponse.json({ serviceCases }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("[portal-service-cases] read failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Your care requests are temporarily unavailable." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}

export async function POST(request: Request) {
  const access = await authorizePortalRequest(request);
  if (!access) return unauthorized();
  try {
    const input = (await request.json()) as {
      clientRequestId?: string;
      category?: CustomerServiceCaseCategory;
      appointmentId?: string | null;
      details?: string;
    };
    const result = await createPortalServiceCase({
      access,
      clientRequestId: input.clientRequestId ?? "",
      category: input.category as CustomerServiceCaseCategory,
      appointmentId: input.appointmentId,
      details: input.details ?? "",
    });
    return NextResponse.json(result, {
      status: result.duplicate ? 200 : 201,
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    if (error instanceof CustomerServiceCaseActionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: PRIVATE_HEADERS },
      );
    }
    console.error("[portal-service-cases] create failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Your care request could not be saved. Please try again." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
