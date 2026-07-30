import { describe, expect, it } from "vitest";
import {
  jobberWebhookSyncScope,
  parseJobberWebhookPayload,
} from "./jobber-webhook";

describe("Jobber webhook routing", () => {
  it("parses Jobber's current data.webHookEvent envelope", () => {
    expect(
      parseJobberWebhookPayload(
        JSON.stringify({
          data: {
            webHookEvent: {
              topic: "VISIT_UPDATE",
              appId: "app-1",
              accountId: "account-1",
              itemId: "visit-1",
              occurredAt: "2026-07-30T18:00:00.000Z",
            },
          },
        }),
      ),
    ).toEqual({
      topic: "VISIT_UPDATE",
      appId: "app-1",
      accountId: "account-1",
      itemId: "visit-1",
      occurredAt: "2026-07-30T18:00:00.000Z",
    });
  });

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
