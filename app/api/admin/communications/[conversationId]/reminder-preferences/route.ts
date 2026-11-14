import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { DEFAULT_REMINDER_OFFSETS, parseReminderOffsets } from "@/lib/communications/reminder-preferences";

async function account(conversationId: string) {
  const db = createServiceRoleSupabaseClient();
  const result = await db.from("customer_conversations").select("homeowner_id").eq("id", conversationId).maybeSingle();
  if (result.error) throw new Error("Conversation unavailable");
  return { db, homeownerId: result.data?.homeowner_id as string | undefined };
}
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  if (!authorizeAdminRequest(request.headers)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { db, homeownerId } = await account((await context.params).conversationId);
    if (!homeownerId) return NextResponse.json({ error: "This conversation is not linked to a customer account." }, { status: 404 });
    const result = await db.from("customer_visit_reminder_preferences").select("offset_minutes").eq("homeowner_id", homeownerId).maybeSingle();
    if (result.error) throw new Error("Preferences unavailable");
    return NextResponse.json({ offsetMinutes: result.data?.offset_minutes ?? DEFAULT_REMINDER_OFFSETS }, { headers });
  } catch { return NextResponse.json({ error: "Reminder preferences unavailable" }, { status: 503, headers }); }
}
export async function PATCH(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  if (!authorizeAdminRequest(request.headers)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  let offsets: number[];
  try { offsets = parseReminderOffsets(body?.offsetMinutes); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid timing" }, { status: 400, headers }); }
  try {
    const { db, homeownerId } = await account((await context.params).conversationId);
    if (!homeownerId) return NextResponse.json({ error: "This conversation is not linked to a customer account." }, { status: 404 });
    const result = await db.from("customer_visit_reminder_preferences").upsert({ homeowner_id: homeownerId, offset_minutes: offsets, updated_at: new Date().toISOString() });
    if (result.error) throw new Error("Save failed");
    return NextResponse.json({ offsetMinutes: offsets }, { headers });
  } catch { return NextResponse.json({ error: "Could not save reminder timing" }, { status: 503, headers }); }
}
