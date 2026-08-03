import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const requestFormSource = readFileSync(
  new URL("../../components/acquisition/request-form.tsx", import.meta.url),
  "utf8",
);

describe("public request form SMS disclosure", () => {
  it("keeps consent transactional and presents the required customer help", () => {
    expect(requestFormSource).toContain("transactional texts");
    expect(requestFormSource).toContain("Message frequency varies");
    expect(requestFormSource).toContain("Reply STOP to opt out or HELP for help");
    expect(requestFormSource).toContain("Consent is not a condition of purchase");
    expect(requestFormSource).toContain('href="/privacy"');
    expect(requestFormSource).toContain('href="/terms"');
    expect(requestFormSource).toContain("CUSTOMER_CONTACT.phoneHref");
    expect(requestFormSource).not.toContain("I agree to receive marketing");
    expect(requestFormSource).not.toContain("I agree to receive promotional");
  });
});
