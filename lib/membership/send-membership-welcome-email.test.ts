import { describe, expect, it } from "vitest";
import { welcomeCommunicationAlreadyAccepted } from "./send-membership-welcome-email";

describe("welcomeCommunicationAlreadyAccepted", () => {
  it("prevents automatic duplicates after a provider accepted the message", () => {
    expect(
      welcomeCommunicationAlreadyAccepted({
        status: "accepted",
        provider_message_id: "email-1",
      }),
    ).toBe(true);
    expect(
      welcomeCommunicationAlreadyAccepted({
        status: "failed",
        provider_message_id: "email-1",
      }),
    ).toBe(true);
  });

  it("allows recovery after a local skipped or failed attempt", () => {
    expect(
      welcomeCommunicationAlreadyAccepted({
        status: "skipped",
        provider_message_id: null,
      }),
    ).toBe(false);
    expect(
      welcomeCommunicationAlreadyAccepted({
        status: "failed",
        provider_message_id: null,
      }),
    ).toBe(false);
  });
});
