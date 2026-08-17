import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { probeDocuSignEnrollmentTemplate } from "@/lib/integrations/docusign";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await probeDocuSignEnrollmentTemplate();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
