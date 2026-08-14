import { describe, expect, it } from "vitest";
import {
  buildCommunicationsLaunchReadiness,
  type CommunicationsLaunchReadinessInput,
} from "./integration-launch-readiness-core";

function input(
  overrides: Partial<CommunicationsLaunchReadinessInput> = {},
): CommunicationsLaunchReadinessInput {
  return {
    generatedAt: "2026-08-14T18:00:00.000Z",
    publicSiteUrl: "https://www.squeegeeking.net",
    twilio: {
      credentialsConfigured: false,
      senderConfigured: false,
      statusCallbackConfigured: false,
      senderApproved: false,
      signedWebhookVerified: false,
      signedWebhookReason: "signed_webhook_not_seen",
    },
    meta: {
      appSecretConfigured: false,
      verifyTokenConfigured: false,
      pageAccessTokenConfigured: false,
      graphApiVersionConfigured: false,
      callbackChallengeVerified: false,
      signedWebhookVerified: false,
      proofAvailable: true,
      latestLeadReceivedAt: null,
    },
    scheduler: { cronSecretConfigured: false },
    ...overrides,
  };
}

describe("communications launch readiness", () => {
  it("fails closed and returns exact production callback URLs", () => {
    const readiness = buildCommunicationsLaunchReadiness(input());

    expect(readiness.twilio.state).toBe("needs_action");
    expect(readiness.meta.state).toBe("needs_action");
    expect(readiness.scheduler.state).toBe("needs_action");
    expect(readiness.twilio.callbackUrls.map((entry) => entry.url)).toEqual([
      "https://www.squeegeeking.net/api/integrations/twilio/inbound",
      "https://www.squeegeeking.net/api/integrations/twilio/status",
    ]);
    expect(readiness.meta.callbackUrls[0]?.url).toBe(
      "https://www.squeegeeking.net/api/integrations/meta/leads",
    );
  });

  it("distinguishes carrier waiting from unfinished software setup", () => {
    const readiness = buildCommunicationsLaunchReadiness(
      input({
        twilio: {
          credentialsConfigured: true,
          senderConfigured: true,
          statusCallbackConfigured: true,
          senderApproved: false,
          signedWebhookVerified: false,
          signedWebhookReason: "signed_webhook_not_seen",
        },
      }),
    );

    expect(readiness.twilio.state).toBe("waiting");
    expect(
      readiness.twilio.steps.find((step) => step.id === "registration")?.status,
    ).toBe("waiting");
  });

  it("requires current signed proofs and a saved Meta lead before reporting ready", () => {
    const base = input({
      twilio: {
        credentialsConfigured: true,
        senderConfigured: true,
        statusCallbackConfigured: true,
        senderApproved: true,
        signedWebhookVerified: true,
        signedWebhookReason: null,
      },
      meta: {
        appSecretConfigured: true,
        verifyTokenConfigured: true,
        pageAccessTokenConfigured: true,
        graphApiVersionConfigured: true,
        callbackChallengeVerified: true,
        signedWebhookVerified: true,
        proofAvailable: true,
        latestLeadReceivedAt: null,
      },
      scheduler: { cronSecretConfigured: true },
    });

    const awaitingLead = buildCommunicationsLaunchReadiness(base);
    expect(awaitingLead.twilio.state).toBe("ready");
    expect(awaitingLead.meta.state).toBe("waiting");

    const complete = buildCommunicationsLaunchReadiness({
      ...base,
      meta: {
        ...base.meta,
        latestLeadReceivedAt: "2026-08-14T17:55:00.000Z",
      },
    });
    expect(complete.meta.state).toBe("ready");
    expect(complete.meta.completedSteps).toBe(complete.meta.totalSteps);
  });

  it("never serializes provider secrets", () => {
    const serialized = JSON.stringify(buildCommunicationsLaunchReadiness(input()));
    expect(serialized).not.toContain("authToken");
    expect(serialized).not.toContain("appSecret");
    expect(serialized).not.toContain("pageAccessToken");
    expect(serialized).not.toContain("verifyToken");
  });
});
