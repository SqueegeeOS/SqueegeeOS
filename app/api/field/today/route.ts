import { NextResponse } from "next/server";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import { loadFieldTodayBoard } from "@/lib/field-operations/field-scope";
import { addFieldCustomerPhones } from "@/lib/field-operations/field-customer-contact-server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor) {
    return NextResponse.json({ error: "Technician Access required" }, { status: 401, headers });
  }

  try {
    const board = await loadFieldTodayBoard(actor);
    const visits = await addFieldCustomerPhones(actor, board.visits);
    return NextResponse.json({ ...board, visits }, { headers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Field Run failed";
    console.error("[field-today] load failed:", message);
    return NextResponse.json(
      { error: "Could not load your assigned Jobber route." },
      { status: 503, headers },
    );
  }
}
