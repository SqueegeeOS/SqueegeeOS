import { NextResponse } from "next/server";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import { loadFieldTodayBoard } from "@/lib/field-operations/field-scope";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor) {
    return NextResponse.json({ error: "Technician Access required" }, { status: 401 });
  }

  try {
    return NextResponse.json(await loadFieldTodayBoard(actor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Field Run failed";
    console.error("[field-today] load failed:", message);
    return NextResponse.json(
      { error: "Could not load your assigned Jobber route." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
