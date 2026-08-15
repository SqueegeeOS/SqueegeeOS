import { NextResponse } from "next/server";
import { loadOwnerAttentionQueue } from "@/lib/admin/owner-attention-server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  try {
    return NextResponse.json(await loadOwnerAttentionQueue(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[owner-attention] queue failed", error);
    return NextResponse.json(
      { error: "Could not build the owner attention queue." },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
