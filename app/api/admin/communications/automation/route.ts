import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

const ALLOWED_RULE_IDS = new Set([
  "lead_acknowledgement_email",
  "lead_acknowledgement_sms",
  "visit_reminder_24h_email",
  "visit_reminder_24h_sms",
]);

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_communication_automation_rules")
    .select(
      "id, event_type, channel, enabled, consent_required, verified_contact_required, schedule_offset_minutes, template_key, updated_at",
    )
    .order("event_type", { ascending: true })
    .order("channel", { ascending: true });
  if (error) {
    return NextResponse.json({ error: "Automation rules unavailable" }, { status: 503 });
  }
  return NextResponse.json({ rules: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    enabled?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!ALLOWED_RULE_IDS.has(id) || typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid automation update" }, { status: 400 });
  }
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_communication_automation_rules")
    .update({ enabled: body.enabled })
    .eq("id", id)
    .select(
      "id, event_type, channel, enabled, consent_required, verified_contact_required, schedule_offset_minutes, template_key, updated_at",
    )
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Automation update failed" }, { status: 500 });
  }
  return NextResponse.json({ rule: data }, { headers: { "Cache-Control": "no-store" } });
}
