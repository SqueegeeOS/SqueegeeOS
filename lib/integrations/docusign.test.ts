import {
  createHmac,
  createVerify,
  generateKeyPairSync,
} from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createDocuSignJwtAssertion,
  getDocuSignConfigState,
  parseDocuSignEnvelopeEvent,
  type DocuSignConfig,
  verifyDocuSignConnectHmac,
} from "./docusign";

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}

describe("DocuSign integration boundary", () => {
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
});
