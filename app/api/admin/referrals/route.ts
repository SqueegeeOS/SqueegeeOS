import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { listReferralsForHq } from "@/lib/referrals/repository";

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await listReferralsForHq();
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ error: "Failed to load referrals" }, { status: 500 });
  }
}
