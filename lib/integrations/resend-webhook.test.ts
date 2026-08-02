import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { customerMessageStatusForResendEvent } from "./resend-webhook";

const source = readFileSync(new URL("./resend-webhook.ts", import.meta.url), "utf8");

describe("Resend customer message delivery mapping", () => {
  it("tracks delivery and engagement events", () => {
    expect(customerMessageStatusForResendEvent("email.delivered")).toBe(
      "delivered",
    );
    expect(customerMessageStatusForResendEvent("email.opened")).toBe("opened");
    expect(customerMessageStatusForResendEvent("email.clicked")).toBe("clicked");
  });

  it("normalizes failure and delay events", () => {
    expect(customerMessageStatusForResendEvent("email.delivery_delayed")).toBe(
      "delivery_delayed",
    );
    expect(customerMessageStatusForResendEvent("email.bounced")).toBe("bounced");
    expect(customerMessageStatusForResendEvent("unknown.event")).toBeNull();
  });

  it("suppresses complained and bounced destinations, not only the message", () => {
    expect(source).toContain("suppressFailedEmailDestination");
    expect(source).toContain('email_delivery_status: input.status');
    expect(source).toContain('consent_status: "opted_out"');
    expect(source).toContain('verification_status: "invalid"');
  });
});
