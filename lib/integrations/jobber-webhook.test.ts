import { describe, expect, it } from "vitest";
import {
  jobberWebhookSyncScope,
  parseJobberWebhookPayload,
} from "./jobber-webhook";

describe("Jobber webhook routing", () => {
  it("routes customer and visit events to their bounded sync", () => {
    expect(jobberWebhookSyncScope("CLIENT_UPDATE")).toBe("clients");
    expect(jobberWebhookSyncScope("VISIT_CREATE")).toBe("visits");
    expect(jobberWebhookSyncScope("JOB_UPDATE")).toBe("visits");
    expect(jobberWebhookSyncScope("PROPERTY_UPDATE")).toBe("full");
    expect(jobberWebhookSyncScope("INVOICE_CREATE")).toBe("ignored");
  });

  it("rejects payloads without a topic", () => {
    expect(parseJobberWebhookPayload('{"itemId":"1"}')).toBeNull();
    expect(parseJobberWebhookPayload("not json")).toBeNull();
  });
});
