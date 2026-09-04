import { NextResponse } from "next/server";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import { scopeTodayBoardToTechnician } from "@/lib/field-operations/field-scope";
import { loadJobberTodayBoard } from "@/lib/care-operations/jobber-today";
import { getBusinessCalendarDayUtcBounds, COMPANY_BUSINESS_TIMEZONE } from "@/lib/admin/company-business-timezone";
import { fieldUpcomingVisits } from "@/lib/field-operations/field-upcoming";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor) return NextResponse.json({ error: "Technician Access required" }, { status: 401, headers });
  try {
    const now = new Date();
    const board = await loadJobberTodayBoard(now, new Date(now.getTime() + 45 * 86400000));
    const scoped = actor.kind === "technician" ? scopeTodayBoardToTechnician(board, actor.jobberUserId) : board;
    const { endUtc } = getBusinessCalendarDayUtcBounds(now, COMPANY_BUSINESS_TIMEZONE);
    return NextResponse.json({ visits: fieldUpcomingVisits(scoped.visits, endUtc), timezone: COMPANY_BUSINESS_TIMEZONE }, { headers });
  } catch {
    return NextResponse.json({ error: "Could not load upcoming jobs. Try again." }, { status: 503, headers });
  }
}
