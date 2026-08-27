import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { prepareDocuSignEnrollmentRehearsalTemplate } from "@/lib/integrations/docusign";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prepareDocuSignEnrollmentRehearsalTemplate();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The DocuSign rehearsal template could not be installed.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
