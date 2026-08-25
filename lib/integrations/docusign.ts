import {
  createHmac,
  createHash,
  createSign,
  timingSafeEqual,
} from "node:crypto";
import type { EnrollmentDocumentSnapshot } from "@/lib/enrollment/types";
import {
  buildDocuSignEnrollmentTabs,
  DOCUSIGN_ENROLLMENT_TAB_LABELS,
} from "@/lib/enrollment/docusign-tabs";

export interface DocuSignConfig {
  integrationKey: string;
  userId: string;
  accountId: string;
  accountBaseUri: string;
  authServer: string;
  privateKey: string;
  enrollmentTemplateId: string;
  customerRoleName: string;
  connectHmacSecret: string;
}

export interface DocuSignConfigState {
  configured: boolean;
  missing: string[];
}

export interface DocuSignEnrollmentTemplateProbe {
  ok: boolean;
  authorization: boolean;
  templateFound: boolean;
  customerRoleFound: boolean;
  templateName: string | null;
  documentCount: number;
  documents: DocuSignTemplateDocumentEvidence[];
  signatureTabCount: number;
  missingTabLabels: string[];
  connectHmacConfigured: boolean;
  errorCode:
    | null
    | "configuration_missing"
    | "authorization_failed"
    | "template_lookup_failed"
    | "template_mismatch";
  message: string;
}

export interface DocuSignTemplateDocumentEvidence {
  documentId: string;
  name: string;
  sha256: string;
  documentKind:
    | "master_service_agreement"
    | "service_quote_agreement"
    | null;
}

export interface DocuSignEnvelopeEvent {
  envelopeId: string;
  eventType: string;
  status: string;
  generatedAt: string | null;
}

function value(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function decodePrivateKey(raw: string): string {
  if (!raw) return "";
  if (raw.includes("BEGIN") || raw.includes("\\n")) {
    return raw.replace(/\\n/g, "\n");
  }
  try {
    return Buffer.from(raw, "base64").toString("utf8").replace(/\\n/g, "\n");
  } catch {
    return "";
  }
}

function normalizeAuthServer(raw: string): string {
  return raw
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "") || "account.docusign.com";
}

function normalizeBaseUri(raw: string): string {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !url.hostname.endsWith("docusign.net")) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

export function resolveDocuSignConfig(
  overrides: Partial<DocuSignConfig> = {},
): DocuSignConfig {
  return {
    integrationKey:
      overrides.integrationKey?.trim() || value("DOCUSIGN_INTEGRATION_KEY"),
    userId: overrides.userId?.trim() || value("DOCUSIGN_USER_ID"),
    accountId: overrides.accountId?.trim() || value("DOCUSIGN_ACCOUNT_ID"),
    accountBaseUri: normalizeBaseUri(
      overrides.accountBaseUri?.trim() || value("DOCUSIGN_ACCOUNT_BASE_URI"),
    ),
    authServer: normalizeAuthServer(
      overrides.authServer?.trim() || value("DOCUSIGN_AUTH_SERVER"),
    ),
    privateKey:
      overrides.privateKey?.trim() ||
      decodePrivateKey(value("DOCUSIGN_PRIVATE_KEY_BASE64")),
    enrollmentTemplateId:
      overrides.enrollmentTemplateId?.trim() ||
      value("DOCUSIGN_ENROLLMENT_TEMPLATE_ID"),
    customerRoleName:
      overrides.customerRoleName?.trim() ||
      value("DOCUSIGN_CUSTOMER_ROLE_NAME") ||
      "Customer",
    connectHmacSecret:
      overrides.connectHmacSecret?.trim() ||
      value("DOCUSIGN_CONNECT_HMAC_SECRET"),
  };
}

export function getDocuSignConfigState(
  config: DocuSignConfig = resolveDocuSignConfig(),
): DocuSignConfigState {
  const required: Array<[string, string]> = [
    ["DOCUSIGN_INTEGRATION_KEY", config.integrationKey],
    ["DOCUSIGN_USER_ID", config.userId],
    ["DOCUSIGN_ACCOUNT_ID", config.accountId],
    ["DOCUSIGN_ACCOUNT_BASE_URI", config.accountBaseUri],
    ["DOCUSIGN_PRIVATE_KEY_BASE64", config.privateKey],
    ["DOCUSIGN_ENROLLMENT_TEMPLATE_ID", config.enrollmentTemplateId],
    ["DOCUSIGN_CONNECT_HMAC_SECRET", config.connectHmacSecret],
  ];
  const missing = required.filter(([, current]) => !current).map(([name]) => name);
  return { configured: missing.length === 0, missing };
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function createDocuSignJwtAssertion(
  config: DocuSignConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: config.integrationKey,
      sub: config.userId,
      aud: config.authServer,
      iat: nowSeconds,
      exp: nowSeconds + 55 * 60,
      scope: "signature impersonation",
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64url(signer.sign(config.privateKey))}`;
}

async function docuSignAccessToken(
  config: DocuSignConfig,
  request: typeof fetch,
): Promise<string> {
  const assertion = createDocuSignJwtAssertion(config);
  const response = await request(`https://${config.authServer}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    error?: unknown;
    error_description?: unknown;
  } | null;
  if (!response.ok || typeof body?.access_token !== "string") {
    const description =
      typeof body?.error_description === "string"
        ? body.error_description
        : typeof body?.error === "string"
          ? body.error
          : `HTTP ${response.status}`;
    throw new Error(`DocuSign authorization failed: ${description}`);
  }
  return body.access_token;
}

function collectTemplateTabLabels(value: unknown): Set<string> {
  const labels = new Set<string>();
  const root = record(value);
  if (!root) return labels;
  for (const tabs of Object.values(root)) {
    if (!Array.isArray(tabs)) continue;
    for (const tab of tabs) {
      const row = record(tab);
      if (typeof row?.tabLabel === "string" && row.tabLabel.trim()) {
        labels.add(row.tabLabel.trim());
      }
    }
  }
  return labels;
}

function providerFailureMessage(body: unknown, status: number): string {
  const row = record(body);
  return (
    firstString(row?.message, row?.errorCode, row?.error) ?? `HTTP ${status}`
  );
}

function classifyEnrollmentDocument(
  name: string,
): DocuSignTemplateDocumentEvidence["documentKind"] {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/(^| )msa( |$)/.test(normalized) || normalized.includes("master service")) {
    return "master_service_agreement";
  }
  if (
    normalized.includes("service quote") ||
    normalized.includes("quote agreement") ||
    normalized.includes("property service agreement")
  ) {
    return "service_quote_agreement";
  }
  return null;
}

export async function probeDocuSignEnrollmentTemplate(input: {
  config?: DocuSignConfig;
  fetch?: typeof fetch;
} = {}): Promise<DocuSignEnrollmentTemplateProbe> {
  const config = input.config ?? resolveDocuSignConfig();
  const request = input.fetch ?? fetch;
  const probeRequired: Array<[string, string]> = [
    ["DOCUSIGN_INTEGRATION_KEY", config.integrationKey],
    ["DOCUSIGN_USER_ID", config.userId],
    ["DOCUSIGN_ACCOUNT_ID", config.accountId],
    ["DOCUSIGN_ACCOUNT_BASE_URI", config.accountBaseUri],
    ["DOCUSIGN_PRIVATE_KEY_BASE64", config.privateKey],
    ["DOCUSIGN_ENROLLMENT_TEMPLATE_ID", config.enrollmentTemplateId],
  ];
  const missing = probeRequired
    .filter(([, current]) => !current)
    .map(([name]) => name);
  const base: Omit<DocuSignEnrollmentTemplateProbe, "ok" | "errorCode" | "message"> = {
    authorization: false,
    templateFound: false,
    customerRoleFound: false,
    templateName: null,
    documentCount: 0,
    documents: [],
    signatureTabCount: 0,
    missingTabLabels: Object.values(DOCUSIGN_ENROLLMENT_TAB_LABELS),
    connectHmacConfigured: Boolean(config.connectHmacSecret),
  };

  if (missing.length > 0) {
    return {
      ...base,
      ok: false,
      errorCode: "configuration_missing",
      message: `Add ${missing.join(", ")} before running the read-only check.`,
    };
  }

  let accessToken: string;
  try {
    accessToken = await docuSignAccessToken(config, request);
  } catch (error) {
    return {
      ...base,
      ok: false,
      errorCode: "authorization_failed",
      message:
        error instanceof Error
          ? error.message
          : "DocuSign authorization failed.",
    };
  }

  const accountPath = `${config.accountBaseUri}/restapi/v2.1/accounts/${encodeURIComponent(config.accountId)}`;
  const templatePath = `${accountPath}/templates/${encodeURIComponent(config.enrollmentTemplateId)}`;
  const readJson = async (url: string, label: string): Promise<unknown> => {
    const response = await request(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `${label} failed: ${providerFailureMessage(body, response.status)}`,
      );
    }
    return body;
  };
  const readBytes = async (url: string, label: string): Promise<Uint8Array> => {
    const response = await request(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `${label} failed: ${body.trim() || `HTTP ${response.status}`}`,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  };

  try {
    const template = record(await readJson(templatePath, "Template lookup"));
    const templateDefinition = record(template?.envelopeTemplateDefinition);
    const [recipientsRaw, documentsRaw] = await Promise.all([
      readJson(`${templatePath}/recipients`, "Template recipient lookup"),
      readJson(`${templatePath}/documents`, "Template document lookup"),
    ]);
    const recipients = record(recipientsRaw);
    const signers = Array.isArray(recipients?.signers)
      ? recipients.signers.map(record).filter((row): row is Record<string, unknown> => Boolean(row))
      : [];
    const customer = signers.find(
      (signer) => firstString(signer.roleName) === config.customerRoleName,
    );
    const recipientId = firstString(customer?.recipientId);
    const tabsRaw = recipientId
      ? await readJson(
          `${templatePath}/recipients/${encodeURIComponent(recipientId)}/tabs`,
          "Template tab lookup",
        )
      : null;
    const tabs = record(tabsRaw);
    const tabLabels = collectTemplateTabLabels(tabs);
    const missingTabLabels = Object.values(
      DOCUSIGN_ENROLLMENT_TAB_LABELS,
    ).filter((label) => !tabLabels.has(label));
    const documents = record(documentsRaw);
    const documentRows = [
      documents?.templateDocuments,
      documents?.envelopeDocuments,
      documents?.documents,
    ].find(Array.isArray);
    const documentCount = Array.isArray(documentRows) ? documentRows.length : 0;
    const documentDescriptors = Array.isArray(documentRows)
      ? documentRows
          .map(record)
          .filter((row): row is Record<string, unknown> => Boolean(row))
          .map((row) => ({
            documentId: firstString(row.documentId),
            name: firstString(row.name) ?? "Unnamed document",
          }))
          .filter(
            (row): row is { documentId: string; name: string } =>
              Boolean(row.documentId),
          )
      : [];
    const documentEvidence = await Promise.all(
      documentDescriptors.map(async (document) => {
        const bytes = await readBytes(
          `${templatePath}/documents/${encodeURIComponent(document.documentId)}`,
          `Template document ${document.documentId} download`,
        );
        return {
          ...document,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          documentKind: classifyEnrollmentDocument(document.name),
        } satisfies DocuSignTemplateDocumentEvidence;
      }),
    );
    const coreDocumentKinds = new Set(
      documentEvidence
        .map((document) => document.documentKind)
        .filter(
          (
            kind,
          ): kind is Exclude<
            DocuSignTemplateDocumentEvidence["documentKind"],
            null
          > => kind !== null,
        ),
    );
    const signatureTabCount = Array.isArray(tabs?.signHereTabs)
      ? tabs.signHereTabs.length
      : 0;
    const customerRoleFound = Boolean(customer && recipientId);
    const templateFound = Boolean(
      firstString(template?.templateId, templateDefinition?.templateId),
    );
    const ok =
      templateFound &&
      customerRoleFound &&
      documentCount >= 2 &&
      signatureTabCount >= 1 &&
      missingTabLabels.length === 0 &&
      coreDocumentKinds.has("master_service_agreement") &&
      coreDocumentKinds.has("service_quote_agreement");

    return {
      ...base,
      ok,
      authorization: true,
      templateFound,
      customerRoleFound,
      templateName: firstString(template?.name, templateDefinition?.name),
      documentCount,
      documents: documentEvidence,
      signatureTabCount,
      missingTabLabels,
      errorCode: ok ? null : "template_mismatch",
      message: ok
        ? "DocuSign OAuth and the two-document HomeAtlas template passed the read-only check. Connect still requires one signed webhook rehearsal."
        : "DocuSign authorized, but the configured template does not yet match the HomeAtlas MSA, Service & Quote, role, signature, and locked-tab contract.",
    };
  } catch (error) {
    return {
      ...base,
      authorization: true,
      ok: false,
      errorCode: "template_lookup_failed",
      message:
        error instanceof Error
          ? error.message
          : "DocuSign template lookup failed.",
    };
  }
}

export async function createDocuSignEnrollmentEnvelope(input: {
  packetId: string;
  snapshot: EnrollmentDocumentSnapshot;
  legalCompanyName: string;
  legalBusinessAddress: string;
  legalNoticeEmail: string;
  legalPhone: string;
  config?: DocuSignConfig;
  fetch?: typeof fetch;
}): Promise<{ envelopeId: string; status: string }> {
  const config = input.config ?? resolveDocuSignConfig();
  const state = getDocuSignConfigState(config);
  if (!state.configured) {
    throw new Error(`DocuSign is not configured: ${state.missing.join(", ")}`);
  }
  const request = input.fetch ?? fetch;
  const accessToken = await docuSignAccessToken(config, request);
  const endpoint = `${config.accountBaseUri}/restapi/v2.1/accounts/${encodeURIComponent(config.accountId)}/envelopes`;
  const response = await request(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateId: config.enrollmentTemplateId,
      templateRoles: [
        {
          email: (input.snapshot.signer ?? input.snapshot.customer).email,
          name: (input.snapshot.signer ?? input.snapshot.customer).name,
          roleName: config.customerRoleName,
          clientUserId: input.packetId,
          tabs: {
            textTabs: buildDocuSignEnrollmentTabs({
              snapshot: input.snapshot,
              legalCompanyName: input.legalCompanyName,
              legalBusinessAddress: input.legalBusinessAddress,
              legalNoticeEmail: input.legalNoticeEmail,
              legalPhone: input.legalPhone,
            }),
          },
        },
      ],
      customFields: {
        textCustomFields: [
          {
            name: "HomeAtlas Enrollment Packet ID",
            value: input.packetId,
            required: "true",
            show: "false",
          },
        ],
      },
      emailSubject: `${(input.snapshot.signer ?? input.snapshot.customer).name}, your SqueegeeKing home-care plan is ready`,
      emailBlurb:
        "Your plan is ready. DocuSign will walk you through two clear documents: the master terms and your property-specific service quote. It usually takes just a few minutes.",
      // Persist the external envelope id before allowing DocuSign to email the
      // customer. This prevents an orphaned live send if our database write
      // fails immediately after envelope creation.
      status: "created",
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    envelopeId?: unknown;
    status?: unknown;
    message?: unknown;
    errorCode?: unknown;
  } | null;
  if (!response.ok || typeof body?.envelopeId !== "string") {
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.errorCode === "string"
          ? body.errorCode
          : `HTTP ${response.status}`;
    throw new Error(`DocuSign could not send the envelope: ${message}`);
  }
  return {
    envelopeId: body.envelopeId,
    status: typeof body.status === "string" ? body.status : "created",
  };
}

export async function createDocuSignRecipientView(input: {
  envelopeId: string;
  packetId: string;
  snapshot: EnrollmentDocumentSnapshot;
  returnUrl: string;
  config?: DocuSignConfig;
  fetch?: typeof fetch;
}): Promise<string> {
  const config = input.config ?? resolveDocuSignConfig();
  const state = getDocuSignConfigState(config);
  if (!state.configured) {
    throw new Error(`DocuSign is not configured: ${state.missing.join(", ")}`);
  }
  const request = input.fetch ?? fetch;
  const accessToken = await docuSignAccessToken(config, request);
  const response = await request(
    `${config.accountBaseUri}/restapi/v2.1/accounts/${encodeURIComponent(config.accountId)}/envelopes/${encodeURIComponent(input.envelopeId)}/views/recipient`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        returnUrl: input.returnUrl,
        authenticationMethod: "none",
        email: (input.snapshot.signer ?? input.snapshot.customer).email,
        userName: (input.snapshot.signer ?? input.snapshot.customer).name,
        clientUserId: input.packetId,
      }),
    },
  );
  const body = (await response.json().catch(() => null)) as {
    url?: unknown;
    message?: unknown;
    errorCode?: unknown;
  } | null;
  if (!response.ok || typeof body?.url !== "string") {
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.errorCode === "string"
          ? body.errorCode
          : `HTTP ${response.status}`;
    throw new Error(`DocuSign signing session could not start: ${message}`);
  }
  const signingUrl = new URL(body.url);
  const trustedHost =
    signingUrl.protocol === "https:" &&
    (signingUrl.hostname === "docusign.com" ||
      signingUrl.hostname.endsWith(".docusign.com") ||
      signingUrl.hostname === "docusign.net" ||
      signingUrl.hostname.endsWith(".docusign.net"));
  if (!trustedHost) {
    throw new Error("DocuSign returned an invalid signing-session URL.");
  }
  return signingUrl.toString();
}

export async function sendCreatedDocuSignEnvelope(input: {
  envelopeId: string;
  config?: DocuSignConfig;
  fetch?: typeof fetch;
}): Promise<void> {
  const config = input.config ?? resolveDocuSignConfig();
  const state = getDocuSignConfigState(config);
  if (!state.configured) {
    throw new Error(`DocuSign is not configured: ${state.missing.join(", ")}`);
  }
  const request = input.fetch ?? fetch;
  const accessToken = await docuSignAccessToken(config, request);
  const response = await request(
    `${config.accountBaseUri}/restapi/v2.1/accounts/${encodeURIComponent(config.accountId)}/envelopes/${encodeURIComponent(input.envelopeId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "sent" }),
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
      errorCode?: unknown;
    } | null;
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.errorCode === "string"
          ? body.errorCode
          : `HTTP ${response.status}`;
    throw new Error(`DocuSign could not send the prepared envelope: ${message}`);
  }
}

export async function downloadDocuSignEnvelopeDocument(input: {
  envelopeId: string;
  documentId: "combined" | "certificate";
  config?: DocuSignConfig;
  fetch?: typeof fetch;
}): Promise<Uint8Array> {
  const config = input.config ?? resolveDocuSignConfig();
  const state = getDocuSignConfigState(config);
  if (!state.configured) {
    throw new Error(`DocuSign is not configured: ${state.missing.join(", ")}`);
  }
  const request = input.fetch ?? fetch;
  const accessToken = await docuSignAccessToken(config, request);
  const response = await request(
    `${config.accountBaseUri}/restapi/v2.1/accounts/${encodeURIComponent(config.accountId)}/envelopes/${encodeURIComponent(input.envelopeId)}/documents/${input.documentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(
      `DocuSign document download failed (${input.documentId}, HTTP ${response.status}).`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

export function verifyDocuSignConnectHmac(input: {
  rawBody: string;
  signatures: Array<string | null>;
  secret?: string;
}): boolean {
  const secret = input.secret?.trim() || resolveDocuSignConfig().connectHmacSecret;
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(input.rawBody, "utf8")
    .digest();
  return input.signatures.some((candidate) => {
    if (!candidate?.trim()) return false;
    try {
      const actual = Buffer.from(candidate.trim(), "base64");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function parseDocuSignEnvelopeEvent(
  rawBody: string,
): DocuSignEnvelopeEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const root = record(parsed);
  if (!root) return null;
  const data = record(root.data);
  const summary = record(root.envelopeSummary) ?? record(data?.envelopeSummary);
  const envelopeId = firstString(
    data?.envelopeId,
    summary?.envelopeId,
    root.envelopeId,
  );
  const eventType = firstString(root.event, root.eventType, data?.event) ?? "unknown";
  const explicitStatus = firstString(summary?.status, data?.status, root.status);
  const normalizedEvent = eventType.toLowerCase();
  const status =
    explicitStatus?.toLowerCase() ??
    (normalizedEvent.includes("completed")
      ? "completed"
      : normalizedEvent.includes("declined")
        ? "declined"
        : normalizedEvent.includes("void")
          ? "voided"
          : normalizedEvent.includes("sent")
            ? "sent"
            : "unknown");
  if (!envelopeId) return null;
  return {
    envelopeId,
    eventType,
    status,
    generatedAt: firstString(
      summary?.completedDateTime,
      data?.completedDateTime,
      root.generatedDateTime,
      data?.generatedDateTime,
    ),
  };
}
