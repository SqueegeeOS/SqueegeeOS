import "server-only";

import { PUBLIC_SITE_URL } from "@/lib/brand/urls";
import {
  buildCommunicationsLaunchReadiness,
  type CommunicationsLaunchReadiness,
} from "@/lib/communications/integration-launch-readiness-core";
import { getCommunicationAutomationReadiness } from "@/lib/communications/provider-readiness";
import {
  normalizeE164,
  normalizeHttpsUrl,
} from "@/lib/communications/providers/contracts";
import { resolveTwilioSmsConfig } from "@/lib/communications/providers/twilio-sms";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
} from "@/lib/persistence/supabase/client";
import { readCurrentMetaWebhookProof } from "@/lib/integrations/meta-webhook-readiness";

interface MetaLeadProof {
  available: boolean;
  latestLeadReceivedAt: string | null;
}

function hasValidTwilioAccountSid(value: string): boolean {
  return /^AC[0-9a-fA-F]{32}$/.test(value);
}

function hasValidMessagingServiceSid(value: string | undefined): boolean {
  return /^MG[0-9a-fA-F]{32}$/.test(value ?? "");
}

async function readLatestMetaLeadProof(): Promise<MetaLeadProof> {
  if (!isCloudPersistenceConnected() || !isServiceRoleConfigured()) {
    return { available: false, latestLeadReceivedAt: null };
  }
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("lead_intakes")
    .select("submitted_at")
    .eq("source", "facebook_lead_ad")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { available: false, latestLeadReceivedAt: null };
  return {
    available: true,
    latestLeadReceivedAt:
      typeof data?.submitted_at === "string" ? data.submitted_at : null,
  };
}

export async function loadCommunicationsLaunchReadiness(): Promise<CommunicationsLaunchReadiness> {
  const twilio = resolveTwilioSmsConfig();
  const expectedStatusUrl = `${PUBLIC_SITE_URL}/api/integrations/twilio/status`;
  const cloudProofAvailable =
    isCloudPersistenceConnected() && isServiceRoleConfigured();
  const [twilioWebhook, metaWebhook, metaLead] = await Promise.all([
    getCommunicationAutomationReadiness("twilio").catch(() => ({
      ready: false,
      reason: "verification_schema_unavailable",
    })),
    cloudProofAvailable
      ? readCurrentMetaWebhookProof()
      : Promise.resolve({
          available: false,
          callbackChallengeVerified: false,
          signedWebhookVerified: false,
        }),
    readLatestMetaLeadProof(),
  ]);

  return buildCommunicationsLaunchReadiness({
    generatedAt: new Date().toISOString(),
    publicSiteUrl: PUBLIC_SITE_URL,
    twilio: {
      credentialsConfigured:
        hasValidTwilioAccountSid(twilio.accountSid) && Boolean(twilio.authToken),
      senderConfigured:
        Boolean(normalizeE164(twilio.fromNumber)) ||
        hasValidMessagingServiceSid(twilio.messagingServiceSid),
      statusCallbackConfigured:
        normalizeHttpsUrl(twilio.statusCallbackUrl) === expectedStatusUrl,
      senderApproved:
        process.env.TWILIO_SENDER_APPROVED?.trim().toLowerCase() === "true",
      signedWebhookVerified: twilioWebhook.ready,
      signedWebhookReason: twilioWebhook.reason,
    },
    meta: {
      appSecretConfigured: Boolean(process.env.META_APP_SECRET?.trim()),
      verifyTokenConfigured: Boolean(
        process.env.META_WEBHOOK_VERIFY_TOKEN?.trim(),
      ),
      pageAccessTokenConfigured: Boolean(
        process.env.META_PAGE_ACCESS_TOKEN?.trim(),
      ),
      graphApiVersionConfigured: /^v\d+\.\d+$/.test(
        process.env.META_GRAPH_API_VERSION?.trim() ?? "",
      ),
      callbackChallengeVerified: metaWebhook.callbackChallengeVerified,
      signedWebhookVerified: metaWebhook.signedWebhookVerified,
      proofAvailable: metaWebhook.available && metaLead.available,
      latestLeadReceivedAt: metaLead.latestLeadReceivedAt,
    },
    scheduler: {
      cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    },
  });
}
