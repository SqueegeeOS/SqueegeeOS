import { NextResponse } from "next/server";
import { resolvePortalAccessByToken } from "@/lib/persistence/queries/portal-access";
import { saveMembershipPreferredMonths } from "@/lib/membership/visit-preferences-server";

interface VisitPreferenceRequestBody {
  token?: string;
  months?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VisitPreferenceRequestBody;
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const access = await resolvePortalAccessByToken(token);
    if (!access) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const preferences = await saveMembershipPreferredMonths({
      membershipId: access.membershipId,
      months: body.months,
      updatedBy: "customer_portal",
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save preferred months";
    const status = message.startsWith("Choose") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

