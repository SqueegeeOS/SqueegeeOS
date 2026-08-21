import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Jobber full-sync safety contract", () => {
  it("matches only after customer and visit projections are current", () => {
    const source = readFileSync(
      new URL("./jobber-full-sync.ts", import.meta.url),
      "utf8",
    );
    const clientsAt = source.indexOf("await syncAllJobberClients");
    const visitsAt = source.indexOf("await syncAllJobberVisits");
    const matchingAt = source.indexOf("await reconcileStrictExactJobberCustomerLinks");
    expect(clientsAt).toBeGreaterThan(0);
    expect(visitsAt).toBeGreaterThan(clientsAt);
    expect(matchingAt).toBeGreaterThan(visitsAt);
  });

  it("keeps automatic identity matching separate from billing authority", () => {
    const source = readFileSync(
      new URL("./jobber-customer-auto-linking.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain('executionMode: "strict_exact_only"');
    expect(source).toContain("billingEnabled: false");
    expect(source).not.toContain('.from("billing_orders")');
    expect(source).not.toContain("PaymentIntent");
    expect(source).not.toMatch(/\bmutation\b/i);
  });
});
