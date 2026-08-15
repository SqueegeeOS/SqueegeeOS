export type IntegrationLaunchState =
  | "ready"
  | "waiting"
  | "needs_action";

export type IntegrationLaunchStepStatus =
  | "complete"
  | "waiting"
  | "needs_action";

export interface IntegrationLaunchStep {
  id: string;
  label: string;
  status: IntegrationLaunchStepStatus;
  detail: string;
}

export interface IntegrationLaunchCard {
  id: "twilio" | "meta";
  label: string;
  state: IntegrationLaunchState;
  summary: string;
  completedSteps: number;
  totalSteps: number;
  actionUrl: string;
  actionLabel: string;
  callbackUrls: Array<{ label: string; url: string }>;
  steps: IntegrationLaunchStep[];
}

export interface CommunicationsLaunchReadiness {
  generatedAt: string;
  twilio: IntegrationLaunchCard;
  meta: IntegrationLaunchCard;
  scheduler: {
    state: IntegrationLaunchState;
    label: string;
    detail: string;
    route: string;
  };
}

export interface CommunicationsLaunchReadinessInput {
  generatedAt: string;
  publicSiteUrl: string;
  twilio: {
    credentialsConfigured: boolean;
    senderConfigured: boolean;
    statusCallbackConfigured: boolean;
    senderApproved: boolean;
    signedWebhookVerified: boolean;
    signedWebhookReason: string | null;
  };
  meta: {
    appSecretConfigured: boolean;
    verifyTokenConfigured: boolean;
    pageAccessTokenConfigured: boolean;
    graphApiVersionConfigured: boolean;
    callbackChallengeVerified: boolean;
    signedWebhookVerified: boolean;
    proofAvailable: boolean;
    latestLeadReceivedAt: string | null;
  };
  scheduler: {
    cronSecretConfigured: boolean;
  };
}

function completedSteps(steps: IntegrationLaunchStep[]): number {
  return steps.filter((step) => step.status === "complete").length;
}

function webhookReasonDetail(reason: string | null): string {
  switch (reason) {
    case "webhook_secret_missing":
      return "Add the Twilio auth token before verifying signed callbacks.";
    case "verification_schema_unavailable":
      return "Atlas cannot read the provider-verification table; check the database migration.";
    case "current_webhook_secret_not_verified":
      return "The auth token changed. Send a fresh signed Twilio callback for the current token.";
    case "signed_webhook_not_seen":
      return "Send one signed inbound or delivery-status test from Twilio.";
    default:
      return "Atlas still needs one signed inbound or delivery-status callback from Twilio.";
  }
}

function buildTwilioCard(
  input: CommunicationsLaunchReadinessInput,
): IntegrationLaunchCard {
  const prerequisitesComplete =
    input.twilio.credentialsConfigured &&
    input.twilio.senderConfigured &&
    input.twilio.statusCallbackConfigured;
  const steps: IntegrationLaunchStep[] = [
    {
      id: "credentials",
      label: "Account credentials",
      status: input.twilio.credentialsConfigured ? "complete" : "needs_action",
      detail: input.twilio.credentialsConfigured
        ? "Account SID and auth token are present on the server."
        : "Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Vercel.",
    },
    {
      id: "sender",
      label: "Sending identity",
      status: input.twilio.senderConfigured ? "complete" : "needs_action",
      detail: input.twilio.senderConfigured
        ? "A valid sending number or Messaging Service is connected."
        : "Add a Twilio number or Messaging Service SID.",
    },
    {
      id: "callbacks",
      label: "Atlas callbacks",
      status: input.twilio.statusCallbackConfigured
        ? "complete"
        : "needs_action",
      detail: input.twilio.statusCallbackConfigured
        ? "Outbound delivery status points to the production Atlas endpoint."
        : "Set the exact production status callback in Twilio and Vercel.",
    },
    {
      id: "registration",
      label: "U.S. carrier registration",
      status: input.twilio.senderApproved
        ? "complete"
        : prerequisitesComplete
          ? "waiting"
          : "needs_action",
      detail: input.twilio.senderApproved
        ? "Sender approval is recorded in Atlas."
        : prerequisitesComplete
          ? "Waiting for Twilio to approve the sender; leave automations off."
          : "Finish the sender and callback setup, then complete Twilio registration.",
    },
    {
      id: "signed-proof",
      label: "Signed webhook proof",
      status: input.twilio.signedWebhookVerified
        ? "complete"
        : input.twilio.senderApproved
          ? "needs_action"
          : "waiting",
      detail: input.twilio.signedWebhookVerified
        ? "Atlas verified a signed callback using the current auth token."
        : webhookReasonDetail(input.twilio.signedWebhookReason),
    },
  ];
  const ready = steps.every((step) => step.status === "complete");
  const waiting =
    !ready &&
    prerequisitesComplete &&
    !input.twilio.senderApproved;

  return {
    id: "twilio",
    label: "Two-way texting",
    state: ready ? "ready" : waiting ? "waiting" : "needs_action",
    summary: ready
      ? "Twilio is verified end to end. Atlas can text only opted-in, verified numbers."
      : waiting
        ? "The software side is staged. Carrier approval is the remaining external gate."
        : "Finish the highlighted setup steps before Atlas can send customer texts.",
    completedSteps: completedSteps(steps),
    totalSteps: steps.length,
    actionUrl: "https://console.twilio.com/",
    actionLabel: "Open Twilio",
    callbackUrls: [
      {
        label: "Incoming messages",
        url: `${input.publicSiteUrl}/api/integrations/twilio/inbound`,
      },
      {
        label: "Delivery status",
        url: `${input.publicSiteUrl}/api/integrations/twilio/status`,
      },
    ],
    steps,
  };
}

function buildMetaCard(
  input: CommunicationsLaunchReadinessInput,
): IntegrationLaunchCard {
  const credentialsComplete =
    input.meta.appSecretConfigured &&
    input.meta.verifyTokenConfigured &&
    input.meta.pageAccessTokenConfigured &&
    input.meta.graphApiVersionConfigured;
  const leadObserved = Boolean(input.meta.latestLeadReceivedAt);
  const steps: IntegrationLaunchStep[] = [
    {
      id: "app-secret",
      label: "Meta app secret",
      status: input.meta.appSecretConfigured ? "complete" : "needs_action",
      detail: input.meta.appSecretConfigured
        ? "The app secret is stored server-side."
        : "Add META_APP_SECRET in Vercel.",
    },
    {
      id: "verify-token",
      label: "Webhook verify token",
      status: input.meta.verifyTokenConfigured ? "complete" : "needs_action",
      detail: input.meta.verifyTokenConfigured
        ? "A private callback verification token is configured."
        : "Generate and add META_WEBHOOK_VERIFY_TOKEN in Vercel.",
    },
    {
      id: "page-access",
      label: "Page access",
      status:
        input.meta.pageAccessTokenConfigured &&
        input.meta.graphApiVersionConfigured
          ? "complete"
          : "needs_action",
      detail:
        input.meta.pageAccessTokenConfigured &&
        input.meta.graphApiVersionConfigured
          ? "A Page token and pinned Graph API version are configured."
          : "Add a long-lived Page token and META_GRAPH_API_VERSION.",
    },
    {
      id: "callback-challenge",
      label: "Meta callback challenge",
      status: input.meta.callbackChallengeVerified
        ? "complete"
        : credentialsComplete
          ? "needs_action"
          : "waiting",
      detail: input.meta.callbackChallengeVerified
        ? "Meta successfully verified the current callback token."
        : credentialsComplete
          ? "Add the Atlas callback in Meta and complete its verification challenge."
          : "This unlocks after the required Meta credentials are configured.",
    },
    {
      id: "signed-webhook",
      label: "Signed webhook event",
      status: input.meta.signedWebhookVerified
        ? "complete"
        : input.meta.callbackChallengeVerified
          ? "needs_action"
          : "waiting",
      detail: input.meta.signedWebhookVerified
        ? "Atlas accepted a webhook signed by the current Meta app secret."
        : input.meta.callbackChallengeVerified
          ? "Send a Meta test event so Atlas can verify the current app secret."
          : "This unlocks after Meta accepts the callback challenge.",
    },
    {
      id: "lead-proof",
      label: "Lead reaches Atlas",
      status: leadObserved
        ? "complete"
        : input.meta.proofAvailable && input.meta.signedWebhookVerified
          ? "needs_action"
          : "waiting",
      detail: leadObserved
        ? `A Facebook lead reached Atlas on ${input.meta.latestLeadReceivedAt}.`
        : input.meta.proofAvailable && input.meta.signedWebhookVerified
          ? "Subscribe the Page to leadgen and submit one safe Meta test lead."
          : input.meta.proofAvailable
            ? "Atlas will confirm this after a signed event and the first test lead."
            : "Atlas cannot read lead proof until cloud storage is available.",
    },
  ];
  const ready = steps.every((step) => step.status === "complete");
  const waiting =
    !ready &&
    credentialsComplete &&
    input.meta.callbackChallengeVerified &&
    input.meta.signedWebhookVerified &&
    !leadObserved;

  return {
    id: "meta",
    label: "Facebook lead intake",
    state: ready ? "ready" : waiting ? "waiting" : "needs_action",
    summary: ready
      ? "A Facebook lead has completed the signed path into the Atlas CRM."
      : waiting
        ? "The webhook is verified; one Page lead test will prove the complete path."
        : "Connect the Meta app, callback, and Page subscription in this order.",
    completedSteps: completedSteps(steps),
    totalSteps: steps.length,
    actionUrl: "https://developers.facebook.com/apps/",
    actionLabel: "Open Meta apps",
    callbackUrls: [
      {
        label: "Lead Ads webhook",
        url: `${input.publicSiteUrl}/api/integrations/meta/leads`,
      },
    ],
    steps,
  };
}

export function buildCommunicationsLaunchReadiness(
  input: CommunicationsLaunchReadinessInput,
): CommunicationsLaunchReadiness {
  return {
    generatedAt: input.generatedAt,
    twilio: buildTwilioCard(input),
    meta: buildMetaCard(input),
    scheduler: {
      state: input.scheduler.cronSecretConfigured ? "ready" : "needs_action",
      label: input.scheduler.cronSecretConfigured
        ? "Daily automation runner is secured"
        : "Daily automation runner needs CRON_SECRET",
      detail: input.scheduler.cronSecretConfigured
        ? "The existing Jobber reconciliation run also processes scheduled conversations and verified visit reminders once per day."
        : "Add CRON_SECRET before relying on scheduled communications. No extra cron slot is required.",
      route: "/api/cron/jobber-reconcile",
    },
  };
}
