import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { homeAtlasTechnicianId } from "@/lib/field-operations/field-access";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { getTwilioSmsConfigState, sendTwilioSms } from "@/lib/communications/providers/twilio-sms";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers });

export async function POST(request: Request, context: { params: Promise<{ grantId: string }> }) {
  if (!authorizeAdminRequest(request.headers)) return reply({ error: "Unauthorized" }, 401);
  if (process.env.VERCEL_ENV === "preview") return reply({ error: "Send technician invites from production HQ." }, 409);
  try {
    const { grantId } = await context.params;
    const body = await request.json();
    if (!/^[0-9a-f-]{36}$/i.test(grantId) || typeof body.inviteToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.inviteToken)) {
      return reply({ error: "Choose a valid invitation." }, 400);
    }
    if (!getTwilioSmsConfigState().configured) return reply({ error: "Texting is not configured." }, 503);
    const db = createServiceRoleSupabaseClient();
    const hash = createHash("sha256").update(body.inviteToken).digest("hex");
    const grant = await db.from("technician_access_grants")
      .select("id, jobber_user_id, display_name, sms_attempted_at, sms_delivery_status, sms_provider_message_id")
      .eq("id", grantId).eq("invite_token_hash", hash).eq("status", "pending")
      .gt("invite_expires_at", new Date().toISOString()).maybeSingle();
    if (grant.error) return reply({ error: "Could not verify the invitation." }, 503);
    if (!grant.data) return reply({ error: "This invitation is expired, claimed, or unavailable." }, 409);
    if (grant.data.sms_attempted_at) return reply({ duplicate: true, status: grant.data.sms_delivery_status || "unknown", providerMessageId: grant.data.sms_provider_message_id });
    const techId = homeAtlasTechnicianId(grant.data.jobber_user_id);
    if (!techId) return reply({ error: "Text invites require an active HomeAtlas technician with a registered phone." }, 422);
    const tech = await db.from("homeatlas_technicians").select("phone_e164, display_name")
      .eq("id", techId).eq("status", "active").maybeSingle();
    if (tech.error) return reply({ error: "Could not verify the technician." }, 503);
    if (!tech.data || tech.data.display_name !== grant.data.display_name || !/^\+[1-9][0-9]{7,14}$/.test(tech.data.phone_e164)) {
      return reply({ error: "The technician's registered phone is unavailable." }, 422);
    }
    const reservation = await db.from("technician_access_grants")
      .update({ sms_attempted_at: new Date().toISOString(), sms_delivery_status: "sending" })
      .eq("id", grantId).eq("status", "pending").is("sms_attempted_at", null)
      .select("id").maybeSingle();
    if (reservation.error) return reply({ error: "Could not reserve the text safely." }, 503);
    if (!reservation.data) return reply({ duplicate: true, status: "sending" });
    const link = `https://www.squeegeeking.net/tech/access?token=${encodeURIComponent(body.inviteToken)}`;
    const result = await sendTwilioSms({ to: tech.data.phone_e164,
      body: `Hi ${tech.data.display_name.split(" ")[0]}! Your SqueegeeKing technician workspace is ready. Open this private link on your phone and activate access within 24 hours: ${link}\n\nTap Upcoming jobs to see your next six weeks. On job day, track your time and save notes/photos in Today. Your referrals are there too. - HomeAtlas` });
    const saved = await db.from("technician_access_grants").update({
      sms_delivery_status: result.ok ? result.status : result.errorCode === "network_error" || result.errorCode === "invalid_response" ? "unknown" : "failed",
      sms_provider_message_id: result.ok ? result.providerMessageId : null,
    }).eq("id", grantId);
    return reply({ status: result.ok ? result.status : "unknown_or_failed", providerMessageId: result.ok ? result.providerMessageId : null,
      destinationEnding: tech.data.phone_e164.slice(-4), receiptSaved: !saved.error,
      ...(!result.ok ? { error: "The send could not be confirmed. Check delivery before creating another invite." } : {}) }, result.ok ? 200 : 502);
  } catch {
    return reply({ error: "The invitation text could not be confirmed. Do not resend until delivery is checked." }, 503);
  }
}
