import "server-only";

import type { LeadIntakeRecord } from "./lead-record";
import { getCommunicationAutomationReadiness } from "@/lib/communications/provider-readiness";
import { sendTwilioSms } from "@/lib/communications/providers/twilio-sms";
import { getCommunicationsConfiguration } from "@/lib/communications/service";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export const WEBSITE_LEAD_ALERT_PHONE = "+15305886235";
export const WEBSITE_LEAD_ALERT_BODY =
  "You Got an Organic Hot Lead on your Website!🔥";

/** Server-selected owner notification; the lead's phone/consent is never used. */
export async function sendWebsiteLeadSmsAlert(
  lead: LeadIntakeRecord,
): Promise<{ sent: boolean; reason?: string }> {
  if (lead.source !== "request_form") {
    return { sent: false, reason: "not_a_website_lead" };
  }
  const readiness = await getCommunicationAutomationReadiness("twilio");
  if (!readiness.ready) {
    return { sent: false, reason: readiness.reason ?? "twilio_webhook_unverified" };
  }
  return sendOwnerLeadSmsAlert(lead, {
    to: WEBSITE_LEAD_ALERT_PHONE,
    body: WEBSITE_LEAD_ALERT_BODY,
  });
}

export async function sendOwnerLeadSmsAlert(
  lead: LeadIntakeRecord,
  alert: { to: string; body: string },
): Promise<{ sent: boolean; reason?: string }> {
  if (!getCommunicationsConfiguration().sms.configured) {
    return { sent: false, reason: "Twilio sender is not approved" };
  }

  const supabase = createServiceRoleSupabaseClient();
  const claimedAt = new Date().toISOString();
  const claimed = await supabase
    .from("lead_intakes")
    .update({
      owner_sms_alert_status: "sending",
      owner_sms_alert_attempted_at: claimedAt,
      owner_sms_alert_failure_code: null,
    })
    .eq("id", lead.id)
    .or("owner_sms_alert_status.is.null,owner_sms_alert_status.eq.failed")
    .select("id")
    .maybeSingle();
  if (claimed.error) return { sent: false, reason: "Alert claim failed" };
  if (!claimed.data) return { sent: true, reason: "already_attempted" };

  const result = await sendTwilioSms(alert);
  const update = result.ok
    ? {
        owner_sms_alert_status: "accepted",
        owner_sms_alert_provider_id: result.providerMessageId,
        owner_sms_alert_failure_code: null,
      }
    : {
        owner_sms_alert_status: "failed",
        owner_sms_alert_provider_id: null,
        owner_sms_alert_failure_code: result.errorCode,
      };
  await supabase.from("lead_intakes").update(update).eq("id", lead.id);
  return result.ok
    ? { sent: true }
    : { sent: false, reason: result.errorCode };
}

