import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processVerifiedAppointmentReminders } from "@/lib/communications/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const actual = Buffer.from(request.headers.get("authorization") ?? "", "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const reminders = await processVerifiedAppointmentReminders();
    return NextResponse.json(
      { ok: true, reminders },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[communications-cron] failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Communications processing failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
