import "server-only";

import { createLeadIntake } from "@/lib/acquisition/leads/repository";
import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import { sendLeadNotificationEmail } from "@/lib/acquisition/send-lead-notification-email";
import { runLeadAcknowledgementAutomation } from "@/lib/communications/lead-automation";
import { normalizeE164 } from "@/lib/communications/providers/contracts";
import { sendTwilioSms } from "@/lib/communications/providers/twilio-sms";
import { ensureLeadConversation } from "@/lib/communications/repository";
import { getCommunicationsConfiguration } from "@/lib/communications/service";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { routeInboundLeadToConfiguredOwner } from "@/lib/sales/inbound-lead-routing-server";
import {
  metaLeadToIntakeInput,
  type MetaLeadDetails,
  type MetaLeadWebhookReference,
  type MetaSmsConsentConfiguration,
} from "./meta-lead-ads";

export interface MetaLeadAdsConfiguration {
  appSecret: string;
  verifyToken: string;
  pageAccessToken: string;
  graphApiVersion: string;
  smsConsent: MetaSmsConsentConfiguration;
}

function csvSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function resolveMetaLeadAdsConfiguration(): MetaLeadAdsConfiguration | null {
  const appSecret = process.env.META_APP_SECRET?.trim() ?? "";
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? "";
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim() ?? "";
  const graphApiVersion = process.env.META_GRAPH_API_VERSION?.trim() ?? "";
  if (
    !appSecret ||
    !verifyToken ||
    !pageAccessToken ||
    !/^v\d+\.\d+$/.test(graphApiVersion)
  ) {
    return null;
  }
  return {
    appSecret,
    verifyToken,
    pageAccessToken,
    graphApiVersion,
    smsConsent: {
      approvedFormIds: csvSet(process.env.META_SMS_CONSENT_FORM_IDS),
      consentFieldNames: csvSet(process.env.META_SMS_CONSENT_FIELD_NAMES),
      disclosureVersion:
        process.env.META_SMS_CONSENT_DISCLOSURE_VERSION?.trim() || null,
    },
  };
}

async function fetchMetaLeadDetails(input: {
  reference: MetaLeadWebhookReference;
  config: MetaLeadAdsConfiguration;
  fetch?: typeof fetch;
}): Promise<MetaLeadDetails> {
  const fields = [
    "id", "created_time", "ad_id", "ad_name", "adset_id", "adset_name",
    "campaign_id", "campaign_name", "form_id", "field_data",
  ].join(",");
  const url = new URL(
    `https://graph.facebook.com/${input.config.graphApiVersion}/${encodeURIComponent(input.reference.leadgenId)}`,
  );
  url.searchParams.set("fields", fields);
  const response = await (input.fetch ?? fetch)(url, {
    headers: { Authorization: `Bearer ${input.config.pageAccessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`meta_lead_fetch_failed:${response.status}`);
  }
  const data = (await response.json().catch(() => null)) as MetaLeadDetails | null;
  if (!data || typeof data !== "object") throw new Error("meta_lead_invalid_response");
  return data;
}

export async function ingestMetaLead(input: {
  reference: MetaLeadWebhookReference;
  config: MetaLeadAdsConfiguration;
  fetch?: typeof fetch;
}): Promise<{ record: LeadIntakeRecord; duplicate: boolean }> {
  const details = await fetchMetaLeadDetails(input);
  const leadInput = metaLeadToIntakeInput({
    reference: input.reference,
    details,
    consent: input.config.smsConsent,
  });
  if (!leadInput) throw new Error("meta_lead_missing_required_contact_fields");
  const created = await createLeadIntake(leadInput);
  if (created.storage !== "supabase") throw new Error("meta_lead_cloud_storage_required");
  await routeInboundLeadToConfiguredOwner({
    leadIntakeId: created.record.id,
  }).catch(() => {
    console.warn("[meta-leads] automatic owner routing incomplete", {
      leadId: created.record.id,
    });
  });
  await ensureLeadConversation({
    leadIntakeId: created.record.id,
    subject: `Facebook lead · ${created.record.name}`,
  });
  return { record: created.record, duplicate: created.duplicate };
}

function ownerAlertPhone(): string | null {
  const first = process.env.LEAD_NOTIFY_SMS?.split(",")[0]?.trim();
  return normalizeE164(first);
}

function ownerAlertBody(lead: LeadIntakeRecord): string {
  const campaign = lead.sourceCampaignName?.trim();
  const interest = lead.servicesInterested.join(", ") || "service plan";
  return [
    "🔥 HOT FACEBOOK LEAD",
    lead.name,
    lead.phone,
    interest,
    campaign ? `Campaign: ${campaign}` : null,
    "Open HomeAtlas → HQ → Communications",
  ].filter(Boolean).join("\n");
}

export async function sendOwnerLeadSmsAlert(
  lead: LeadIntakeRecord,
): Promise<{ sent: boolean; reason?: string }> {
  const to = ownerAlertPhone();
  if (!to) return { sent: false, reason: "LEAD_NOTIFY_SMS not configured" };
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

  const result = await sendTwilioSms({ to, body: ownerAlertBody(lead) });
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

export async function runMetaLeadPostSaveAutomation(
  lead: LeadIntakeRecord,
  options: { notifyFounderByEmail?: boolean } = {},
): Promise<void> {
  const tasks: Array<Promise<unknown>> = [
    runLeadAcknowledgementAutomation(lead),
    sendOwnerLeadSmsAlert(lead),
  ];
  if (options.notifyFounderByEmail !== false) {
    tasks.push(sendLeadNotificationEmail(lead));
  }
  const results = await Promise.allSettled(tasks);
  if (results.some((result) => result.status === "rejected")) {
    console.warn("[meta-leads] post-save automation incomplete", { leadId: lead.id });
  }
}
