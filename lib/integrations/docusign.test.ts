import {
  createHmac,
  createVerify,
  generateKeyPairSync,
} from "node:crypto";
import { describe, expect, it } from "vitest";
import { DOCUSIGN_ENROLLMENT_TAB_LABELS } from "@/lib/enrollment/docusign-tabs";
import {
  createDocuSignEnrollmentEnvelope,
  createDocuSignJwtAssertion,
  createDocuSignRecipientView,
  getDocuSignConfigState,
  parseDocuSignEnvelopeEvent,
  probeDocuSignEnrollmentTemplate,
  type DocuSignConfig,
  verifyDocuSignConnectHmac,
} from "./docusign";
import type { EnrollmentDocumentSnapshot } from "@/lib/enrollment/types";

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}

describe("DocuSign integration boundary", () => {
  it("binds the household packet to one embedded signer and reuses that identity for the signing view", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const config: DocuSignConfig = {
      integrationKey: "integration-key",
      userId: "impersonated-user",
      accountId: "account-id",
      accountBaseUri: "https://na1.docusign.net",
      authServer: "account.docusign.com",
      privateKey,
      enrollmentTemplateId: "template-id",
      customerRoleName: "Customer",
      connectHmacSecret: "webhook-secret",
    };
    const snapshot = {
      schemaVersion: 2,
      presentationId: "presentation-id",
      customer: {
        name: "Michael & Allegra Riley",
        email: "michael@example.com",
        phone: null,
      },
      signer: {
        name: "Michael Riley",
        email: "michael@example.com",
        phone: null,
      },
      property: { fullAddress: "123 Example Lane", squareFeet: null, twoStory: false },
      plan: {
        tier: "quarterly",
        tierLabel: "Quarterly",
        cadence: "4 visits per year",
        visitsPerYear: 4,
        firstVisitPriceCents: 30_000,
        recurringVisitPriceCents: 30_000,
        annualizedValueCents: 160_000,
        addonDiscountPercent: 0,
        summary: "Quarterly care",
        customerChoiceNote: "",
        visits: [],
      },
      payment: { rail: "manual_cash_check", arrangementSummary: "Cash or check" },
      disclosures: {
        salesContext: "remote",
        homeSolicitationNoticeDays: null,
        renewalSummary: "",
        cancellationSummary: "",
        rateChangeSummary: "",
        billingSummary: "",
        billingConsent: "",
      },
      createdAt: "2026-08-24T00:00:00.000Z",
    } satisfies EnrollmentDocumentSnapshot;
    const providerBodies: Array<Record<string, unknown>> = [];
    const request = async (
      url: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      if (String(url).endsWith("/oauth/token")) {
        return Response.json({ access_token: "access-token" });
      }
      providerBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      if (String(url).endsWith("/views/recipient")) {
        return Response.json({ url: "https://apps.docusign.net/signing/session" });
      }
      return Response.json({ envelopeId: "envelope-id", status: "created" });
    };

    await createDocuSignEnrollmentEnvelope({
      packetId: "packet-id",
      snapshot,
      legalCompanyName: "SqueegeeKing LLC",
      legalBusinessAddress: "Chico, CA",
      legalNoticeEmail: "hello@example.com",
      legalPhone: "5305550100",
      config,
      fetch: request as typeof fetch,
    });
    const signingUrl = await createDocuSignRecipientView({
      envelopeId: "envelope-id",
      packetId: "packet-id",
      snapshot,
      returnUrl: "https://www.squeegeeking.net/enroll/private-token",
      config,
      fetch: request as typeof fetch,
    });

    const templateRoles = providerBodies[0]?.templateRoles as Array<Record<string, unknown>>;
    expect(templateRoles[0]).toMatchObject({
      email: "michael@example.com",
      name: "Michael Riley",
      clientUserId: "packet-id",
    });
    expect(providerBodies[1]).toMatchObject({
      email: "michael@example.com",
      userName: "Michael Riley",
      clientUserId: "packet-id",
      authenticationMethod: "none",
    });
    expect(signingUrl).toBe("https://apps.docusign.net/signing/session");
  });

  it("fails configuration readiness when any signing or webhook secret is absent", () => {
    const state = getDocuSignConfigState({
      integrationKey: "integration",
      userId: "user",
      accountId: "account",
      accountBaseUri: "https://na1.docusign.net",
      authServer: "account.docusign.com",
      privateKey: "private",
      enrollmentTemplateId: "",
      customerRoleName: "Customer",
      connectHmacSecret: "",
    });

    expect(state.configured).toBe(false);
    expect(state.missing).toEqual([
      "DOCUSIGN_ENROLLMENT_TEMPLATE_ID",
      "DOCUSIGN_CONNECT_HMAC_SECRET",
    ]);
  });

  it("signs a short-lived JWT assertion with the configured RSA key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const config: DocuSignConfig = {
      integrationKey: "integration-key",
      userId: "impersonated-user",
      accountId: "account",
      accountBaseUri: "https://na1.docusign.net",
      authServer: "account.docusign.com",
      privateKey,
      enrollmentTemplateId: "template",
      customerRoleName: "Customer",
      connectHmacSecret: "webhook-secret",
    };
    const token = createDocuSignJwtAssertion(config, 1_800_000_000);
    const [header, payload, signature] = token.split(".");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    verifier.end();

    expect(decodeJson(header!)).toMatchObject({ alg: "RS256", typ: "JWT" });
    expect(decodeJson(payload!)).toMatchObject({
      iss: "integration-key",
      sub: "impersonated-user",
      aud: "account.docusign.com",
      iat: 1_800_000_000,
      exp: 1_800_003_300,
      scope: "signature impersonation",
    });
    expect(verifier.verify(publicKey, Buffer.from(signature!, "base64url"))).toBe(
      true,
    );
  });

  it("accepts only a valid Connect HMAC and parses completed envelopes", () => {
    const rawBody = JSON.stringify({
      event: "envelope-completed",
      data: {
        envelopeId: "env-066",
        envelopeSummary: {
          status: "completed",
          completedDateTime: "2026-08-15T20:00:00Z",
        },
      },
    });
    const signature = createHmac("sha256", "secret")
      .update(rawBody, "utf8")
      .digest("base64");

    expect(
      verifyDocuSignConnectHmac({
        rawBody,
        secret: "secret",
        signatures: [null, signature],
      }),
    ).toBe(true);
    expect(
      verifyDocuSignConnectHmac({
        rawBody,
        secret: "wrong",
        signatures: [signature],
      }),
    ).toBe(false);
    expect(parseDocuSignEnvelopeEvent(rawBody)).toEqual({
      envelopeId: "env-066",
      eventType: "envelope-completed",
      status: "completed",
      generatedAt: "2026-08-15T20:00:00Z",
    });
    expect(parseDocuSignEnvelopeEvent("not-json")).toBeNull();
  });

  it("probes OAuth, documents, the Customer role, signatures, and locked tabs without writing", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const config: DocuSignConfig = {
      integrationKey: "integration-key",
      userId: "impersonated-user",
      accountId: "account-id",
      accountBaseUri: "https://na1.docusign.net",
      authServer: "account.docusign.com",
      privateKey,
      enrollmentTemplateId: "template-id",
      customerRoleName: "Customer",
      connectHmacSecret: "webhook-secret",
    };
    const calls: Array<{ url: string; method: string }> = [];
    const request = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET" });
      if (url.endsWith("/oauth/token")) {
        return Response.json({ access_token: "access-token" });
      }
      if (url.endsWith("/recipients/7/tabs")) {
        return Response.json({
          signHereTabs: [{ tabId: "signature" }],
          textTabs: Object.values(DOCUSIGN_ENROLLMENT_TAB_LABELS).map(
            (tabLabel) => ({ tabLabel }),
          ),
        });
      }
      if (url.endsWith("/recipients")) {
        return Response.json({
          signers: [{ recipientId: "7", roleName: "Customer" }],
        });
      }
      if (url.endsWith("/documents")) {
        return Response.json({
          templateDocuments: [
            { documentId: "1", name: "Master Service Agreement" },
            { documentId: "2", name: "Property Service Agreement" },
          ],
        });
      }
      if (url.endsWith("/documents/1")) {
        return new Response("exact msa bytes");
      }
      if (url.endsWith("/documents/2")) {
        return new Response("exact service quote bytes");
      }
      if (url.endsWith("/templates/template-id")) {
        return Response.json({
          envelopeTemplateDefinition: {
            templateId: "template-id",
            name: "HomeAtlas enrollment",
          },
        });
      }
      return Response.json({ message: "Unexpected URL" }, { status: 404 });
    };

    const result = await probeDocuSignEnrollmentTemplate({
      config,
      fetch: request as typeof fetch,
    });

    expect(result).toMatchObject({
      ok: true,
      authorization: true,
      templateFound: true,
      customerRoleFound: true,
      templateName: "HomeAtlas enrollment",
      documentCount: 2,
      documents: [
        {
          documentId: "1",
          name: "Master Service Agreement",
          documentKind: "master_service_agreement",
        },
        {
          documentId: "2",
          name: "Property Service Agreement",
          documentKind: "service_quote_agreement",
        },
      ],
      signatureTabCount: 1,
      missingTabLabels: [],
      connectHmacConfigured: true,
      errorCode: null,
    });
    expect(result.documents.every((document) => /^[0-9a-f]{64}$/.test(document.sha256))).toBe(
      true,
    );
    expect(calls).toHaveLength(7);
    expect(calls[0]?.method).toBe("POST");
    expect(calls.slice(1).every((call) => call.method === "GET")).toBe(true);
    expect(calls.some((call) => call.url.includes("/envelopes"))).toBe(false);
  });

  it("fails closed before any network call when probe values are missing", async () => {
    let called = false;
    const result = await probeDocuSignEnrollmentTemplate({
      config: {
        integrationKey: "",
        userId: "",
        accountId: "",
        accountBaseUri: "",
        authServer: "account.docusign.com",
        privateKey: "",
        enrollmentTemplateId: "",
        customerRoleName: "Customer",
        connectHmacSecret: "",
      },
      fetch: (async () => {
        called = true;
        return Response.json({});
      }) as typeof fetch,
    });

    expect(called).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("configuration_missing");
    expect(result.message).toContain("DOCUSIGN_INTEGRATION_KEY");
  });
});
