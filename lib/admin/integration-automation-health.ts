import "server-only";

import { loadAutomaticBillingControlView } from "@/lib/billing/automatic-billing-control";
import { readJobberConnectionStatus } from "@/lib/care-operations/jobber-connection-store";
import { getJobberConfigStatus } from "@/lib/care-operations/jobber-oauth-config";
import { getCommunicationAutomationReadiness } from "@/lib/communications/provider-readiness";
import { getCommunicationsConfiguration } from "@/lib/communications/service";
import type {
  ProductionHealthCheck,
  ProductionHealthSection,
  ProductionHealthStatus,
} from "@/lib/admin/production-health-types";
import { resolveMetaLeadAdsConfiguration } from "@/lib/integrations/meta-lead-ingestion";

function check(
  id: string,
  label: string,
  status: ProductionHealthStatus,
  message: string,
  detail?: string,
): ProductionHealthCheck {
  return { id, label, status, message, detail };
}

function worstStatus(
  statuses: ProductionHealthStatus[],
): ProductionHealthStatus {
  if (statuses.includes("red")) return "red";
  if (statuses.includes("yellow")) return "yellow";
  return "green";
}

function webhookReadinessMessage(
  provider: "Resend" | "Twilio",
  reason: string | null,
): string {
  switch (reason) {
    case "webhook_secret_missing":
      return `Add the ${provider} webhook secret before automating delivery.`;
    case "verification_schema_unavailable":
      return "The provider-verification table is unavailable; review the database migration.";
    case "signed_webhook_not_seen":
      return `Send one signed ${provider} test event to prove the webhook end to end.`;
    case "current_webhook_secret_not_verified":
      return `The ${provider} secret changed; verify the current webhook with a signed event.`;
    default:
      return `${provider} webhook proof is still required.`;
  }
}

function compactDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return `Last verified ${parsed.toISOString().slice(0, 10)}`;
}

export async function runIntegrationAutomationChecks(): Promise<ProductionHealthSection> {
  const jobberConfig = getJobberConfigStatus();
  const communications = getCommunicationsConfiguration();
  const metaConfigured = Boolean(resolveMetaLeadAdsConfiguration());

  const [jobberResult, resendResult, twilioResult, billingResult] =
    await Promise.allSettled([
      jobberConfig.configured
        ? readJobberConnectionStatus()
        : Promise.resolve(null),
      getCommunicationAutomationReadiness("resend"),
      getCommunicationAutomationReadiness("twilio"),
      loadAutomaticBillingControlView(),
    ]);

  const missingJobberParts = [
    !jobberConfig.clientIdConfigured ? "client ID" : null,
    !jobberConfig.clientSecretConfigured ? "client secret" : null,
    !jobberConfig.encryptionKeyConfigured ? "token encryption key" : null,
    !jobberConfig.redirectUriConfigured ? "production redirect URI" : null,
  ].filter((part): part is string => Boolean(part));

  const checks: ProductionHealthCheck[] = [
    check(
      "jobber-oauth-config",
      "Jobber OAuth configuration",
      jobberConfig.configured ? "green" : "yellow",
      jobberConfig.configured
        ? "Jobber credentials, encryption, and callback configuration are present."
        : "Complete the Jobber OAuth configuration before relying on live visit data.",
      missingJobberParts.length
        ? `Missing: ${missingJobberParts.join(", ")}`
        : undefined,
    ),
  ];

  if (jobberResult.status === "fulfilled" && jobberResult.value) {
    const connection = jobberResult.value;
    checks.push(
      check(
        "jobber-connection",
        "Jobber account connection",
        connection.connected ? "green" : "yellow",
        connection.connected
          ? `Connected${connection.accountName ? ` to ${connection.accountName}` : ""}; HomeAtlas can read the linked account.`
          : "Reconnect Jobber before using live schedules, visits, or billing previews.",
        compactDate(connection.lastVerifiedAt),
      ),
    );
  } else {
    checks.push(
      check(
        "jobber-connection",
        "Jobber account connection",
        "yellow",
        jobberConfig.configured
          ? "HomeAtlas could not confirm the saved Jobber connection."
          : "Complete the OAuth configuration, then connect the Jobber account.",
      ),
    );
  }

  checks.push(
    check(
      "email-provider",
      "Customer email",
      communications.email.configured ? "green" : "yellow",
      communications.email.detail,
      communications.email.fromLabel ?? undefined,
    ),
  );

  if (resendResult.status === "fulfilled") {
    checks.push(
      check(
        "resend-webhook",
        "Resend signed webhook",
        resendResult.value.ready ? "green" : "yellow",
        resendResult.value.ready
          ? "A signed Resend event has verified delivery tracking with the current secret."
          : webhookReadinessMessage("Resend", resendResult.value.reason),
      ),
    );
  } else {
    checks.push(
      check(
        "resend-webhook",
        "Resend signed webhook",
        "yellow",
        "HomeAtlas could not confirm Resend webhook proof.",
      ),
    );
  }

  checks.push(
    check(
      "sms-provider",
      "Customer text messaging",
      communications.sms.configured ? "green" : "yellow",
      communications.sms.detail,
      communications.sms.fromLabel ?? undefined,
    ),
  );

  if (twilioResult.status === "fulfilled") {
    checks.push(
      check(
        "twilio-webhook",
        "Twilio signed webhook",
        twilioResult.value.ready ? "green" : "yellow",
        twilioResult.value.ready
          ? "A signed Twilio event has verified inbound and delivery callbacks with the current token."
          : webhookReadinessMessage("Twilio", twilioResult.value.reason),
      ),
    );
  } else {
    checks.push(
      check(
        "twilio-webhook",
        "Twilio signed webhook",
        "yellow",
        "HomeAtlas could not confirm Twilio webhook proof.",
      ),
    );
  }

  checks.push(
    check(
      "atlas-ai",
      "Atlas plan assistant",
      process.env.OPENAI_API_KEY?.trim() ? "green" : "yellow",
      process.env.OPENAI_API_KEY?.trim()
        ? "The server-side AI key is available for personalized care-plan drafting."
        : "Add the server-side OpenAI key to use the plan assistant.",
    ),
    check(
      "address-search",
      "Address autocomplete",
      process.env.GOOGLE_MAPS_API_KEY?.trim() ? "green" : "yellow",
      process.env.GOOGLE_MAPS_API_KEY?.trim()
        ? "Google address lookup is configured; manual editing remains available."
        : "Add the Google Maps key to enable address suggestions; manual entry still works.",
    ),
    check(
      "meta-lead-ads",
      "Facebook lead intake",
      metaConfigured ? "green" : "yellow",
      metaConfigured
        ? "Meta lead credentials and Graph API version are configured."
        : "Connect the Meta lead webhook before expecting Facebook leads in the HomeAtlas inbox.",
    ),
    check(
      "automation-scheduler",
      "Scheduled automation",
      process.env.CRON_SECRET?.trim() ? "green" : "yellow",
      process.env.CRON_SECRET?.trim()
        ? "The scheduler secret is present for Jobber reconciliation, communications, and billing runs."
        : "Add CRON_SECRET before relying on scheduled Jobber, communications, or billing jobs.",
    ),
  );

  if (billingResult.status === "fulfilled") {
    const billing = billingResult.value;
    const exceptionCount =
      billing.failedOrderCount +
      billing.needsActionCount +
      billing.reconciliationRequiredCount;
    const billingArmed =
      billing.settings.enabled &&
      billing.settings.executionMode === "automatic" &&
      billing.stripeLive &&
      billing.stripeWebhookConfigured &&
      billing.stripeWebhookVerified;

    checks.push(
      check(
        "billing-webhook",
        "Stripe webhook proof",
        billing.stripeLive && billing.stripeWebhookVerified
          ? "green"
          : "yellow",
        billing.stripeLive && billing.stripeWebhookVerified
          ? "Stripe is live and the current signed webhook has been verified."
          : "Verify the live Stripe webhook before automatic collection can be armed.",
      ),
      check(
        "automatic-billing",
        "Automatic billing execution",
        billingArmed ? "green" : "yellow",
        billingArmed
          ? `Automatic execution is armed for the ${billing.nextAutomaticBillingDate} run.`
          : billing.settings.enabled
            ? `Billing is enabled in ${billing.settings.executionMode} mode; live automatic execution remains gated.`
            : `Billing is safely paused in ${billing.settings.executionMode} mode; no automatic charges are armed.`,
        `${billing.readyOrderCount} ready order${billing.readyOrderCount === 1 ? "" : "s"}; charge cap $${(billing.settings.maxChargeCents / 100).toLocaleString("en-US")}`,
      ),
      check(
        "billing-exceptions",
        "Billing exception queue",
        exceptionCount > 0 ? "red" : "green",
        exceptionCount > 0
          ? `${exceptionCount} billing order${exceptionCount === 1 ? " needs" : "s need"} founder attention before the next run.`
          : "No failed, action-required, or reconciliation-required billing orders are waiting.",
        exceptionCount > 0
          ? `${billing.failedOrderCount} failed · ${billing.needsActionCount} needs action · ${billing.reconciliationRequiredCount} reconcile`
          : undefined,
      ),
    );
  } else {
    checks.push(
      check(
        "automatic-billing",
        "Automatic billing execution",
        "yellow",
        "HomeAtlas could not load the read-only billing control state. Review billing before the next collection run.",
      ),
    );
  }

  return {
    id: "integrations",
    title: "Integrations & automation",
    checks,
    status: worstStatus(checks.map((item) => item.status)),
  };
}
