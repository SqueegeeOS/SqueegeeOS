import { describe, expect, it } from "vitest";
import { smsConsentStatusForLead } from "./lead-record";

describe("lead SMS consent derivation", () => {
  it("accepts consent only with a validated Text preference", () => {
    expect(smsConsentStatusForLead("Text", true)).toBe("opted_in");
    expect(smsConsentStatusForLead("Phone", true)).toBe("unknown");
    expect(smsConsentStatusForLead("Email", true)).toBe("unknown");
    expect(smsConsentStatusForLead("Text", false)).toBe("unknown");
  });
});
