import "server-only";

import { PUBLIC_SITE_URL } from "@/lib/brand/urls";
import { DOCUSIGN_ENROLLMENT_TAB_LABELS } from "@/lib/enrollment/docusign-tabs";
import {
  resolveDocuSignConfig,
  type DocuSignConfig,
} from "@/lib/integrations/docusign";
import type {
  EnrollmentReadiness,
  EnrollmentReadinessCheck,
} from "@/lib/enrollment/readiness";

export type EnrollmentLaunchStepStatus =
  | "complete"
  | "action_needed"
  | "waiting";

export interface EnrollmentLaunchStep {
  id:
    | "legal_identity"
    | "legal_documents"
    | "release_control"
    | "docusign_jwt"
    | "docusign_template"
    | "docusign_connect"
    | "controlled_test";
  label: string;
  status: EnrollmentLaunchStepStatus;
  detail: string;
  missing: string[];
}

export interface EnrollmentProviderLaunchPlan {
  connectCallbackUrl: string;
  customerRoleName: string;
  requiredTabLabels: string[];
  requiredEnvelopeEvents: string[];
  canRunDocuSignProbe: boolean;
  probeSafetyNote: string;
  steps: EnrollmentLaunchStep[];
  links: {
    docusignAppsAndKeys: string;
    docusignConnect: string;
    vercelEnvironmentVariables: string;
  };
}

const DOCUSIGN_JWT_ENV = [
  "DOCUSIGN_INTEGRATION_KEY",
  "DOCUSIGN_USER_ID",
  "DOCUSIGN_ACCOUNT_ID",
  "DOCUSIGN_ACCOUNT_BASE_URI",
  "DOCUSIGN_PRIVATE_KEY_BASE64",
] as const;

const DOCUSIGN_TEMPLATE_ENV = ["DOCUSIGN_ENROLLMENT_TEMPLATE_ID"] as const;
const DOCUSIGN_CONNECT_ENV = ["DOCUSIGN_CONNECT_HMAC_SECRET"] as const;

function byId(
  readiness: EnrollmentReadiness,
  id: EnrollmentReadinessCheck["id"],
): EnrollmentReadinessCheck {
  return (
    readiness.checks.find((check) => check.id === id) ?? {
      id,
      label: id,
      ready: false,
      detail: "This readiness check did not load.",
      missing: ["readiness_check"],
    }
  );
}

function missingFrom(check: EnrollmentReadinessCheck, names: readonly string[]) {
  return names.filter((name) => check.missing.includes(name));
}

export function getEnrollmentProviderLaunchPlan(
  readiness: EnrollmentReadiness,
  input: {
    publicOrigin?: string;
    docusignConfig?: DocuSignConfig;
  } = {},
): EnrollmentProviderLaunchPlan {
  const publicOrigin = (input.publicOrigin ?? PUBLIC_SITE_URL)
    .trim()
    .replace(/\/$/, "");
  const docusignConfig = input.docusignConfig ?? resolveDocuSignConfig();
  const identity = byId(readiness, "legal_identity");
  const documents = byId(readiness, "legal_documents");
  const releaseControl = byId(readiness, "release_control");
  const docusign = byId(readiness, "docusign");
  const jwtMissing = missingFrom(docusign, DOCUSIGN_JWT_ENV);
  const templateMissing = missingFrom(docusign, DOCUSIGN_TEMPLATE_ENV);
  const connectMissing = missingFrom(docusign, DOCUSIGN_CONNECT_ENV);
  const canRunDocuSignProbe =
    jwtMissing.length === 0 && templateMissing.length === 0;

  return {
    connectCallbackUrl: `${publicOrigin}/api/integrations/docusign/connect`,
    customerRoleName: docusignConfig.customerRoleName || "Customer",
    requiredTabLabels: Object.values(DOCUSIGN_ENROLLMENT_TAB_LABELS),
    requiredEnvelopeEvents: [
      "envelope-sent",
      "envelope-delivered",
      "envelope-completed",
      "envelope-declined",
      "envelope-voided",
    ],
    canRunDocuSignProbe,
    probeSafetyNote:
      "The probe requests an OAuth token, reads the configured template, downloads the exact provider documents to calculate SHA-256 fingerprints, and inspects recipients and tabs. It never creates an envelope, emails a customer, or touches Stripe.",
    steps: [
      {
        id: "legal_identity",
        label: "Lock the seller identity",
        status: identity.ready ? "complete" : "action_needed",
        detail: identity.ready
          ? identity.detail
          : "Use the exact LLC name, business address, notice email, and phone that will appear in every released agreement.",
        missing: identity.missing,
      },
      {
        id: "legal_documents",
        label: "Owner-release the exact legal text",
        status: documents.ready ? "complete" : "waiting",
        detail: documents.ready
          ? documents.detail
          : "Use the working agreements now if the owner accepts them, but release only the exact customer-facing DocuSign files and record both SHA-256 fingerprints. Counsel review remains a later revision, not a false label.",
        missing: documents.missing,
      },
      {
        id: "release_control",
        label: "Lock the first recipient",
        status: releaseControl.ready ? "complete" : "action_needed",
        detail: releaseControl.detail,
        missing: releaseControl.missing,
      },
      {
        id: "docusign_jwt",
        label: "Connect DocuSign JWT",
        status: jwtMissing.length === 0 ? "complete" : "action_needed",
        detail:
          jwtMissing.length === 0
            ? "The production integration identity, RSA key, account, and base URI are present."
            : "Create the production integration key and RSA keypair, grant signature + impersonation consent, then add the server-only values in Vercel.",
        missing: jwtMissing,
      },
      {
        id: "docusign_template",
        label: "Build the two-document template",
        status: templateMissing.length === 0 ? "complete" : "action_needed",
        detail:
          templateMissing.length === 0
            ? "The configured template ID can be checked without sending an envelope."
            : "Use one Customer role, both owner-released documents, signature tabs, and every locked HomeAtlas text-tab label listed below.",
        missing: templateMissing,
      },
      {
        id: "docusign_connect",
        label: "Wire verified completion events",
        status: connectMissing.length === 0 ? "complete" : "action_needed",
        detail:
          connectMissing.length === 0
            ? "A server-side HMAC secret is present for the production Connect listener."
            : "Post JSON envelope events to the callback below and enable HMAC signing. Store the matching secret only in Vercel.",
        missing: connectMissing,
      },
      {
        id: "controlled_test",
        label: "Run one business-owned rehearsal",
        status: readiness.readyToSend ? "action_needed" : "waiting",
        detail: readiness.readyToSend
          ? "All global gates are green. The send path will still reject any recipient that does not match the configured rehearsal address."
          : "This remains locked until released text, identity, rollout control, DocuSign, Stripe, Resend, and the private ledger are all green.",
        missing: readiness.checks
          .filter((check) => !check.ready)
          .map((check) => check.id),
      },
    ],
    links: {
      docusignAppsAndKeys:
        "https://apps.docusign.com/admin/apps-and-keys",
      docusignConnect:
        "https://apps.docusign.com/admin/connect",
      vercelEnvironmentVariables:
        "https://vercel.com/squeegee-os/squeegee-os/settings/environment-variables",
    },
  };
}
