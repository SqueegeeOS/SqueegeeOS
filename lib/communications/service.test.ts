import { describe, expect, it } from "vitest";
import {
  evaluateOutboundCommunicationGate,
  providerStatusToCustomerDeliveryStatus,
} from "./service";
import {
  normalizeCustomerPhone,
  shouldApplyCommunicationDeliveryUpdate,
} from "./repository";

const SMS_DESTINATION = {
  address: "+15035550123",
  contactPointId: null,
  consentStatus: "opted_in" as const,
  verificationStatus: "verified" as const,
};

describe("customer communications send policy", () => {
  it("normalizes common US phone formats to E.164", () => {
    expect(normalizeCustomerPhone("(503) 555-0123")).toBe("+15035550123");
    expect(normalizeCustomerPhone("1-503-555-0123")).toBe("+15035550123");
    expect(normalizeCustomerPhone("+44 20 7946 0958")).toBeNull();
  });

  it("requires an explicit active SMS opt-in", () => {
    expect(
      evaluateOutboundCommunicationGate({
        channel: "sms",
        destination: { ...SMS_DESTINATION, consentStatus: "unknown" },
        providerConfigured: true,
        body: "Your appointment is tomorrow.",
        idempotencyKey: "manual-sms-1",
      }),
    ).toEqual({ allowed: false, code: "sms_consent_required" });

    expect(
      evaluateOutboundCommunicationGate({
        channel: "sms",
        destination: SMS_DESTINATION,
        providerConfigured: true,
        body: "Your appointment is tomorrow.",
        idempotencyKey: "manual-sms-2",
      }),
    ).toMatchObject({
      allowed: true,
      destination: "+15035550123",
      subject: null,
    });
  });

  it("requires a verified mobile destination unless a trusted automation explicitly overrides it", () => {
    const unverified = {
      ...SMS_DESTINATION,
      verificationStatus: "unverified" as const,
    };
    expect(
      evaluateOutboundCommunicationGate({
        channel: "sms",
        destination: unverified,
        providerConfigured: true,
        body: "Your request was received.",
        idempotencyKey: "manual-sms-unverified",
      }),
    ).toEqual({ allowed: false, code: "sms_verification_required" });

    expect(
      evaluateOutboundCommunicationGate({
        channel: "sms",
        destination: unverified,
        providerConfigured: true,
        body: "Your request was received.",
        idempotencyKey: "lead-sms-explicit-consent",
        allowUnverifiedSms: true,
      }),
    ).toMatchObject({ allowed: true, destination: "+15035550123" });
  });

  it("blocks provider-free sends and email opt-outs", () => {
    expect(
      evaluateOutboundCommunicationGate({
        channel: "sms",
        destination: SMS_DESTINATION,
        providerConfigured: false,
        body: "Hello",
        idempotencyKey: "manual-sms-3",
      }),
    ).toEqual({ allowed: false, code: "provider_not_configured" });

    expect(
      evaluateOutboundCommunicationGate({
        channel: "email",
        destination: {
          address: "customer@example.com",
          contactPointId: null,
          consentStatus: "opted_out",
          verificationStatus: "verified",
        },
        providerConfigured: true,
        subject: "Service update",
        body: "Hello",
        idempotencyKey: "manual-email-1",
      }),
    ).toEqual({ allowed: false, code: "email_opted_out" });
  });
});

describe("customer communications delivery progression", () => {
  it("maps provider delivery states into the durable message ledger", () => {
    expect(providerStatusToCustomerDeliveryStatus("queued")).toBe("queued");
    expect(providerStatusToCustomerDeliveryStatus("delayed")).toBe(
      "delivery_delayed",
    );
    expect(providerStatusToCustomerDeliveryStatus("undelivered")).toBe("failed");
    expect(providerStatusToCustomerDeliveryStatus("opened")).toBe("opened");
    expect(providerStatusToCustomerDeliveryStatus("clicked")).toBe("clicked");
  });

  it("does not regress a delivered message when an older event arrives", () => {
    expect(shouldApplyCommunicationDeliveryUpdate("delivered", "sent")).toBe(false);
    expect(shouldApplyCommunicationDeliveryUpdate("sent", "delivered")).toBe(true);
    expect(shouldApplyCommunicationDeliveryUpdate("failed", "delivered")).toBe(false);
  });
});
