import { NextResponse } from "next/server";
import { runProductionCheck } from "@/lib/system/production-check";

export const dynamic = "force-dynamic";

/**
 * Field / ops health check before starting a customer presentation.
 * GET /api/system/production-check
 */
export async function GET() {
  try {
    const result = await runProductionCheck();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Production check failed";
    console.error("[production-check] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
