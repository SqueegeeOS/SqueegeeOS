import "server-only";

import { buildReviewRequestSmsPlan } from "@/lib/communications/automation";
import { getCommunicationAutomationReadiness } from "@/lib/communications/provider-readiness";
import {
  ensureHomeownerConversation,
  loadCommunicationConversationContext,
} from "@/lib/communications/repository";
import {
  getCommunicationsConfiguration,
  sendOutboundCommunication,
} from "@/lib/communications/service";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { resolveGoogleReviewRequestUrl } from "@/lib/reviews/review-request-url-server";
import { recordCustomerAftercareOutcome } from "./customer-aftercare-actions-server";
import { loadCustomerAftercareSnapshot } from "./customer-aftercare-server";
import type { ReviewOpportunityTask } from "./customer-aftercare";

const REVIEW_RULE_ID = "review_request_after_visit_sms";
const ACCEPTED_DELIVERY_STATES = new Set([
  "queued",
  "accepted",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "read",
]);

interface ReviewRuleRow {
  id: string;
  enabled: boolean;
  consent_required: boolean;
  verified_contact_required: boolean;
}

export type ReviewRequestAutomationState =
  | "active"
  | "off"
  | "waiting_for_twilio"
  | "waiting_for_review_link"
  | "not_installed";

export interface ReviewRequestAutomationStatus {
  state: ReviewRequestAutomationState;
  installed: boolean;
  enabled: boolean;
  twilioConfigured: boolean;
  twilioReady: boolean;
  reviewLinkReady: boolean;
  detail: string;
}

export interface ReviewRequestAutomationRunSummary {
  state: ReviewRequestAutomationState;
  candidates: number;
  sent: number;
  duplicate: number;
  skipped: number;
  failed: number;
  resolved: number;
}

async function loadReviewRule(): Promise<ReviewRuleRow | null> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("customer_communication_automation_rules")
    .select("id, enabled, consent_required, verified_contact_required")
    .eq("id", REVIEW_RULE_ID)
    .maybeSingle();
  if (result.error) throw new Error("review_request_rule_unavailable");
  return (result.data as ReviewRuleRow | null) ?? null;
}

export async function loadReviewRequestAutomationStatus(): Promise<ReviewRequestAutomationStatus> {
  const [rule, reviewUrl, twilioReadiness] = await Promise.all([
    loadReviewRule().catch(() => null),
    resolveGoogleReviewRequestUrl().catch(() => null),
    getCommunicationAutomationReadiness("twilio").catch(() => ({
      ready: false,
      reason: "readiness_unavailable",
    })),
  ]);
  const twilioConfigured = getCommunicationsConfiguration().sms.configured;
  const installed = Boolean(rule);
  const enabled = rule?.enabled === true;
  const reviewLinkReady = Boolean(reviewUrl);

  if (!installed) {
    return {
      state: "not_installed",
      installed,
      enabled,
      twilioConfigured,
      twilioReady: twilioReadiness.ready,
      reviewLinkReady,
      detail: "Install the review-request migration before this automation can run.",
    };
  }
  if (!reviewLinkReady) {
    return {
      state: "waiting_for_review_link",
      installed,
      enabled,
      twilioConfigured,
      twilioReady: twilioReadiness.ready,
      reviewLinkReady,
      detail: "Connect the Google Business location or add its review link.",
    };
  }
  if (!twilioConfigured || !twilioReadiness.ready) {
    return {
      state: "waiting_for_twilio",
      installed,
      enabled,
      twilioConfigured,
      twilioReady: twilioReadiness.ready,
      reviewLinkReady,
      detail: "Twilio approval and a signed webhook verification are still required.",
    };
  }
  if (!enabled) {
    return {
      state: "off",
      installed,
      enabled,
      twilioConfigured,
      twilioReady: twilioReadiness.ready,
      reviewLinkReady,
      detail: "All connections are ready. Turn on the review-request rule in Communications.",
    };
  }
  return {
    state: "active",
    installed,
    enabled,
    twilioConfigured,
    twilioReady: twilioReadiness.ready,
    reviewLinkReady,
    detail: "Eligible completed visits will receive one consent-checked review request.",
  };
}

function reviewTasks(tasks: Awaited<ReturnType<typeof loadCustomerAftercareSnapshot>>["tasks"]): ReviewOpportunityTask[] {
  return tasks.filter(
    (task): task is ReviewOpportunityTask => task.type === "review_opportunity",
  );
}

export async function processEligibleReviewRequests(
  now = new Date(),
): Promise<ReviewRequestAutomationRunSummary> {
  const status = await loadReviewRequestAutomationStatus();
  const summary: ReviewRequestAutomationRunSummary = {
    state: status.state,
    candidates: 0,
    sent: 0,
    duplicate: 0,
    skipped: 0,
    failed: 0,
    resolved: 0,
  };
  if (status.state !== "active") return summary;

  const [rule, reviewUrl, snapshot] = await Promise.all([
    loadReviewRule(),
    resolveGoogleReviewRequestUrl(),
    loadCustomerAftercareSnapshot(now),
  ]);
  if (!rule || !reviewUrl) return { ...summary, state: "waiting_for_review_link" };

  const candidates = reviewTasks(snapshot.tasks);
  summary.candidates = candidates.length;
  for (const task of candidates) {
    try {
      const conversation = await ensureHomeownerConversation({
        homeownerId: task.homeownerId,
        subject: "Service follow-up",
      });
      const context = await loadCommunicationConversationContext(conversation.id);
      const destination = context?.sms;
      if (
        !context ||
        !destination ||
        (rule.verified_contact_required &&
          destination.verificationStatus !== "verified") ||
        (rule.consent_required && destination.consentStatus !== "opted_in")
      ) {
        summary.skipped += 1;
        continue;
      }

      const plan = buildReviewRequestSmsPlan({
        appointmentId: task.appointmentId,
        customerName: context.customerName,
        phone: destination.address,
        serviceLabel: task.serviceLabel,
        completedAt: task.completedAt,
        now,
        reviewUrl,
        smsConsent: {
          consented: destination.consentStatus === "opted_in",
          consentedAt:
            destination.consentStatus === "opted_in" ? now.toISOString() : null,
          optedOutAt:
            destination.consentStatus === "opted_out" ? now.toISOString() : null,
        },
      });
      if (!plan || new Date(plan.notBefore).getTime() > now.getTime()) {
        summary.skipped += 1;
        continue;
      }

      const result = await sendOutboundCommunication({
        conversationId: conversation.id,
        channel: "sms",
        body: plan.text,
        idempotencyKey: plan.idempotencyKey,
        metadata: {
          source: "review_request_aftercare_cron",
          automationRuleId: rule.id,
          taskKey: task.taskKey,
          appointmentId: task.appointmentId,
          membershipId: task.membershipId,
        },
      });
      if (!ACCEPTED_DELIVERY_STATES.has(result.message.deliveryStatus)) {
        summary.failed += 1;
        continue;
      }
      if (result.duplicate) summary.duplicate += 1;
      else summary.sent += 1;

      await recordCustomerAftercareOutcome(
        {
          taskKey: task.taskKey,
          outcome: "review_requested",
          note: "Review request sent automatically after a verified completed visit.",
          recordedBy: "HomeAtlas review automation",
        },
        now,
      );
      summary.resolved += 1;
    } catch (error) {
      summary.failed += 1;
      console.warn("[review-request-automation] customer send failed", {
        appointmentId: task.appointmentId,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return summary;
}
