import { describe, expect, it } from "vitest";
import { getEnrollmentProviderLaunchPlan } from "./provider-launch";
import type { EnrollmentReadiness } from "./readiness";
import type { DocuSignConfig } from "@/lib/integrations/docusign";

const emptyConfig: DocuSignConfig = {
  integrationKey: "",
  userId: "",
  accountId: "",
  accountBaseUri: "",
  authServer: "account.docusign.com",
  privateKey: "",
  enrollmentTemplateId: "",
  customerRoleName: "Customer",
  connectHmacSecret: "",
};

function readiness(overrides: Partial<Record<string, boolean>> = {}): EnrollmentReadiness {
  const checks = [
    "database",
    "legal_documents",
    "legal_identity",
    "release_control",
    "docusign",
    "stripe",
    "email",
  ].map((id) => {
    const ready = overrides[id] ?? false;
    const missing =
      id === "docusign" && !ready
        ? [
            "DOCUSIGN_INTEGRATION_KEY",
            "DOCUSIGN_USER_ID",
            "DOCUSIGN_ACCOUNT_ID",
            "DOCUSIGN_ACCOUNT_BASE_URI",
            "DOCUSIGN_PRIVATE_KEY_BASE64",
            "DOCUSIGN_ENROLLMENT_TEMPLATE_ID",
            "DOCUSIGN_CONNECT_HMAC_SECRET",
          ]
        : ready
          ? []
          : [`missing_${id}`];
    return {
      id: id as EnrollmentReadiness["checks"][number]["id"],
      label: id,
      ready,
      detail: ready ? "ready" : "not ready",
      missing,
    };
  });
  return {
    readyToSend: checks.every((check) => check.ready),
    checks,
    approvedVersions: { msa: null, serviceQuote: null },
    legalIdentity: null,
    releaseControl: {
      mode: "rehearsal",
      ready: overrides.release_control ?? false,
      rehearsalRecipientConfigured: overrides.release_control ?? false,
      rehearsalRecipientHint: overrides.release_control
        ? "ow***@example.com"
        : null,
      rehearsalConfirmed: false,
      detail: overrides.release_control ? "ready" : "not ready",
      missing: overrides.release_control
        ? []
        : ["HOMEATLAS_ENROLLMENT_REHEARSAL_EMAIL"],
    },
  };
}

describe("enrollment provider launch plan", () => {
  it("turns opaque readiness failures into a safe activation manifest", () => {
    const plan = getEnrollmentProviderLaunchPlan(readiness(), {
      publicOrigin: "https://www.squeegeeking.net/",
      docusignConfig: emptyConfig,
    });

    expect(plan.connectCallbackUrl).toBe(
      "https://www.squeegeeking.net/api/integrations/docusign/connect",
    );
    expect(plan.customerRoleName).toBe("Customer");
    expect(plan.requiredTabLabels).toContain("billing_consent");
    expect(plan.requiredTabLabels).toContain("home_solicitation_notice");
    expect(plan.canRunDocuSignProbe).toBe(false);
    expect(plan.steps.find((step) => step.id === "docusign_jwt")?.missing).toContain(
      "DOCUSIGN_PRIVATE_KEY_BASE64",
    );
    expect(plan.probeSafetyNote).toContain("never creates an envelope");
    expect(plan.steps.find((step) => step.id === "release_control")?.status).toBe(
      "action_needed",
    );
  });

  it("unlocks the read-only probe before Connect and owner release are complete", () => {
    const partial = readiness();
    const docusign = partial.checks.find((check) => check.id === "docusign")!;
    docusign.missing = ["DOCUSIGN_CONNECT_HMAC_SECRET"];
    const config = {
      ...emptyConfig,
      integrationKey: "integration-id",
      userId: "user-id",
      accountId: "account-id",
      accountBaseUri: "https://na4.docusign.net",
      privateKey: "private-key",
      enrollmentTemplateId: "template-id",
    };

    const plan = getEnrollmentProviderLaunchPlan(partial, {
      docusignConfig: config,
    });

    expect(plan.canRunDocuSignProbe).toBe(true);
    expect(plan.steps.find((step) => step.id === "docusign_jwt")?.status).toBe(
      "complete",
    );
    expect(
      plan.steps.find((step) => step.id === "docusign_connect")?.status,
    ).toBe("action_needed");
  });
});
