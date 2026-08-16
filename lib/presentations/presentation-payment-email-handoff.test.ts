import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PresentationPaymentEmailHandoff } from "@/components/presentations/presentation-payment-email-handoff";

describe("presentation payment email handoff", () => {
  it("offers one explicit no-charge email action for a signed member", () => {
    const html = renderToStaticMarkup(
      createElement(PresentationPaymentEmailHandoff, {
        membershipId: "00000000-0000-4000-8000-000000000001",
        presentationId: "00000000-0000-4000-8000-000000000002",
        customerEmail: "HOMEOWNER@EXAMPLE.COM",
        returnLabel: "Return to field desk",
        onReturn: () => undefined,
      }),
    );

    expect(html).toContain("Finish on their phone");
    expect(html).toContain("homeowner@example.com");
    expect(html).toContain("Email secure Stripe link");
    expect(html).toContain("No charge occurs here");
    expect(html).toContain("Nothing sends until you press");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("fails closed when the presentation has no valid customer email", () => {
    const html = renderToStaticMarkup(
      createElement(PresentationPaymentEmailHandoff, {
        membershipId: "00000000-0000-4000-8000-000000000001",
        presentationId: "00000000-0000-4000-8000-000000000002",
        customerEmail: "not-an-email",
        returnLabel: "Done",
        onReturn: () => undefined,
      }),
    );

    expect(html).toContain("Add a valid customer email");
    expect(html).toContain("Email secure Stripe link");
    expect(html).toContain("disabled=\"\"");
  });
});
