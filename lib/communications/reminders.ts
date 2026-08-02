import "server-only";

import { buildVerifiedAppointmentReminderPlan } from "@/lib/communications/automation";
import {
  ensureHomeownerConversation,
  loadCommunicationConversationContext,
} from "@/lib/communications/repository";
import { sendOutboundCommunication } from "@/lib/communications/service";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

interface ReminderRuleRow {
  id: string;
  channel: "email" | "sms";
  enabled: boolean;
  consent_required: boolean;
  verified_contact_required: boolean;
}

interface AppointmentRow {
  id: string;
  member_profile_id: string;
  property_id: string;
  external_id: string;
  service_type: string;
  scheduled_at: string;
  status: string;
  verification_state: string;
  match_state: string;
}

function serviceLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export interface AppointmentReminderRunSummary {
  candidates: number;
  sent: number;
  duplicate: number;
  skipped: number;
  failed: number;
}

export async function processVerifiedAppointmentReminders(
  now = new Date(),
): Promise<AppointmentReminderRunSummary> {
  const summary: AppointmentReminderRunSummary = {
    candidates: 0,
    sent: 0,
    duplicate: 0,
    skipped: 0,
    failed: 0,
  };
  const supabase = createServiceRoleSupabaseClient();
  const rulesResult = await supabase
    .from("customer_communication_automation_rules")
    .select("id, channel, enabled, consent_required, verified_contact_required")
    .eq("event_type", "visit_reminder_24h")
    .eq("enabled", true);
  if (rulesResult.error) throw new Error("reminder_rules_unavailable");
  const rules = (rulesResult.data ?? []) as ReminderRuleRow[];
  if (rules.length === 0) return summary;

  // Hobby deployments run this once per day. A 26-hour lookahead provides a
  // safe catch-up window; idempotency prevents repeats if the route is retried.
  const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1_000);
  const appointmentsResult = await supabase
    .from("member_appointments")
    .select(
      "id, member_profile_id, property_id, external_id, service_type, scheduled_at, status, verification_state, match_state",
    )
    .eq("provider", "jobber")
    .eq("status", "scheduled")
    .eq("verification_state", "verified")
    .eq("match_state", "matched")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", windowEnd.toISOString())
    .order("scheduled_at", { ascending: true });
  if (appointmentsResult.error) throw new Error("reminder_appointments_unavailable");
  const appointments = (appointmentsResult.data ?? []) as AppointmentRow[];
  summary.candidates = appointments.length;
  if (appointments.length === 0) return summary;

  const profileIds = [...new Set(appointments.map((row) => row.member_profile_id))];
  const propertyIds = [...new Set(appointments.map((row) => row.property_id))];
  const [profilesResult, propertiesResult] = await Promise.all([
    supabase.from("member_profiles").select("id, homeowner_id").in("id", profileIds),
    supabase
      .from("properties")
      .select("id, address, city, state, zip")
      .in("id", propertyIds),
  ]);
  if (profilesResult.error || propertiesResult.error) {
    throw new Error("reminder_customer_context_unavailable");
  }
  const homeownerByProfile = new Map(
    (profilesResult.data ?? []).map((row) => [row.id as string, row.homeowner_id as string]),
  );
  const propertyById = new Map(
    (propertiesResult.data ?? []).map((row) => [
      row.id as string,
      [row.address, row.city, row.state, row.zip].filter(Boolean).join(", "),
    ]),
  );

  for (const appointment of appointments) {
    const homeownerId = homeownerByProfile.get(appointment.member_profile_id);
    if (!homeownerId) {
      summary.skipped += rules.length;
      continue;
    }
    try {
      const conversation = await ensureHomeownerConversation({
        homeownerId,
        subject: "Service visit updates",
      });
      const context = await loadCommunicationConversationContext(conversation.id);
      if (!context) {
        summary.skipped += rules.length;
        continue;
      }

      for (const rule of rules) {
        const destination = rule.channel === "email" ? context.email : context.sms;
        if (!destination) {
          summary.skipped += 1;
          continue;
        }
        if (
          rule.verified_contact_required &&
          destination.verificationStatus !== "verified"
        ) {
          summary.skipped += 1;
          continue;
        }
        if (rule.consent_required && destination.consentStatus !== "opted_in") {
          summary.skipped += 1;
          continue;
        }
        const plan = buildVerifiedAppointmentReminderPlan({
          externalAppointmentId: appointment.external_id,
          customerName: context.customerName,
          serviceLabel: serviceLabel(appointment.service_type),
          serviceAddress: propertyById.get(appointment.property_id) ?? null,
          scheduledAt: appointment.scheduled_at,
          status: appointment.status,
          verificationState: appointment.verification_state,
          matchState: appointment.match_state,
          now,
          preferredChannel: rule.channel,
          email: rule.channel === "email" ? destination.address : null,
          phone: rule.channel === "sms" ? destination.address : null,
          smsConsent:
            rule.channel === "sms"
              ? {
                  consented: destination.consentStatus === "opted_in",
                  consentedAt:
                    destination.consentStatus === "opted_in"
                      ? now.toISOString()
                      : null,
                  optedOutAt:
                    destination.consentStatus === "opted_out"
                      ? now.toISOString()
                      : null,
                }
              : null,
        });
        if (!plan || new Date(plan.notBefore).getTime() > now.getTime()) {
          summary.skipped += 1;
          continue;
        }
        try {
          const sent = await sendOutboundCommunication({
            conversationId: conversation.id,
            channel: rule.channel,
            subject: plan.subject,
            body: plan.text,
            idempotencyKey: plan.idempotencyKey,
            metadata: {
              source: "appointment_reminder_cron",
              automationRuleId: rule.id,
              appointmentId: appointment.id,
              externalAppointmentId: appointment.external_id,
            },
          });
          if (sent.duplicate) summary.duplicate += 1;
          else summary.sent += 1;
        } catch (error) {
          summary.failed += 1;
          console.warn("[appointment-reminders] send failed", {
            appointmentId: appointment.id,
            channel: rule.channel,
            reason: error instanceof Error ? error.message : "unknown",
          });
        }
      }
    } catch (error) {
      summary.failed += rules.length;
      console.warn("[appointment-reminders] customer context failed", {
        appointmentId: appointment.id,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return summary;
}
