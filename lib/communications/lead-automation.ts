import "server-only";

import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import {
  buildLeadAcknowledgementEmailPlan,
  buildLeadFirstTouchSmsPlan,
} from "@/lib/communications/automation";
import { ensureLeadConversation } from "@/lib/communications/repository";
import {
  scheduleOutboundCommunication,
  sendOutboundCommunication,
} from "@/lib/communications/service";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

interface AutomationRuleState {
  enabled: boolean;
  verifiedContactRequired: boolean;
}

async function loadAutomationRule(
  eventType: "lead_acknowledgement",
  channel: "email" | "sms",
): Promise<AutomationRuleState> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_communication_automation_rules")
    .select("enabled, verified_contact_required")
    .eq("event_type", eventType)
    .eq("channel", channel)
    .maybeSingle();
  if (error) throw new Error("communication_rule_lookup_failed");
  return {
    enabled: data?.enabled === true,
    verifiedContactRequired: data?.verified_contact_required === true,
  };
}

export async function runLeadAcknowledgementAutomation(
  lead: LeadIntakeRecord,
): Promise<{
  conversationId: string;
  emailSent: boolean;
  smsSent: boolean;
  smsScheduled: boolean;
  duplicate: boolean;
  emailDuplicate: boolean;
  smsDuplicate: boolean;
  reason?: string;
  smsReason?: string;
}> {
  const sourceLabel =
    lead.source === "facebook_lead_ad" ? "Facebook lead" : "Website request";
  const conversation = await ensureLeadConversation({
    leadIntakeId: lead.id,
    subject: `${sourceLabel} · ${lead.name}`,
  });
  const [emailRule, smsRule] = await Promise.all([
    loadAutomationRule("lead_acknowledgement", "email"),
    loadAutomationRule("lead_acknowledgement", "sms"),
  ]);
  const emailPlan = buildLeadAcknowledgementEmailPlan({
    leadId: lead.id,
    customerName: lead.name,
    email: lead.email,
    services: lead.servicesInterested,
    requestedAt: lead.submittedAt,
  });
  let emailSent = false;
  let emailDuplicate = false;
  let reason: string | undefined;
  if (!emailRule.enabled) {
    reason = "automation_disabled";
  } else if (!emailPlan) {
    reason = "invalid_automation_plan";
  } else {
    try {
      const result = await sendOutboundCommunication({
        conversationId: conversation.id,
        channel: "email",
        subject: emailPlan.subject,
        body: emailPlan.text,
        idempotencyKey: emailPlan.idempotencyKey,
        metadata: {
          source:
            lead.source === "facebook_lead_ad"
              ? "facebook_lead_automation"
              : "website_lead_automation",
          automationKind: emailPlan.kind,
        },
      });
      emailSent = result.message.deliveryStatus !== "failed";
      emailDuplicate = result.duplicate;
    } catch (error) {
      reason = error instanceof Error ? error.message : "email_automation_failed";
    }
  }

  const smsPlan = buildLeadFirstTouchSmsPlan({
    leadId: lead.id,
    customerName: lead.name,
    phone: lead.phone,
    services: lead.servicesInterested,
    requestedAt: lead.submittedAt,
    preferredChannel: lead.preferredContactMethod,
    smsConsent: {
      consented: lead.smsConsentStatus === "opted_in",
      consentedAt: lead.smsConsentRecordedAt,
      optedOutAt:
        lead.smsConsentStatus === "opted_out"
          ? lead.smsConsentRecordedAt
          : null,
    },
    source: lead.source,
  });
  let smsSent = false;
  let smsScheduled = false;
  let smsDuplicate = false;
  let smsReason: string | undefined;
  if (!smsRule.enabled) {
    smsReason = "automation_disabled";
  } else if (!smsPlan) {
    smsReason = "consent_preference_or_plan_invalid";
  } else {
    const allowUnverifiedSms = !smsRule.verifiedContactRequired;
    const metadata = {
      source:
        lead.source === "facebook_lead_ad"
          ? "facebook_lead_automation"
          : "website_lead_automation",
      automationKind: smsPlan.kind,
      ...(allowUnverifiedSms
        ? { verificationOverride: "lead_form_explicit_consent" }
        : {}),
    };
    try {
      if (new Date(smsPlan.notBefore).getTime() > Date.now()) {
        const result = await scheduleOutboundCommunication({
          conversationId: conversation.id,
          channel: "sms",
          body: smsPlan.text,
          idempotencyKey: smsPlan.idempotencyKey,
          scheduledFor: smsPlan.notBefore,
          metadata,
          allowUnverifiedSms,
        });
        smsScheduled = result.message.deliveryStatus === "scheduled";
        smsDuplicate = result.duplicate;
      } else {
        const result = await sendOutboundCommunication({
          conversationId: conversation.id,
          channel: "sms",
          body: smsPlan.text,
          idempotencyKey: smsPlan.idempotencyKey,
          metadata,
          allowUnverifiedSms,
        });
        smsSent = result.message.deliveryStatus !== "failed";
        smsDuplicate = result.duplicate;
      }
    } catch (error) {
      smsReason = error instanceof Error ? error.message : "sms_automation_failed";
    }
  }

  return {
    conversationId: conversation.id,
    emailSent,
    smsSent,
    smsScheduled,
    duplicate: emailDuplicate || smsDuplicate,
    emailDuplicate,
    smsDuplicate,
    reason,
    smsReason,
  };
}
