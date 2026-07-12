import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { loadMonthlyBillingPreview } from "@/lib/care-operations/monthly-preview";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers.get("x-admin-pin"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = new URL(request.url).searchParams.get("month");
  if (!month) {
    return NextResponse.json({ error: "A month query parameter is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await loadMonthlyBillingPreview(month));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load billing preview";
    const status = message.startsWith("Service month") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
