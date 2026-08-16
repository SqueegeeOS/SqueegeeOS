import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hook = readFileSync(
  new URL("./use-payment-handoff-refresh.ts", import.meta.url),
  "utf8",
);
const ownerInbox = readFileSync(
  new URL("../../components/admin/owner-sales-inbox-page.tsx", import.meta.url),
  "utf8",
);

describe("payment handoff foreground revalidation", () => {
  it("refreshes only while enabled, visible, and not already in flight", () => {
    expect(hook).toContain("if (!enabled) return");
    expect(hook).toContain('document.visibilityState !== "visible"');
    expect(hook).toContain("refreshInFlight");
    expect(hook).toContain('window.addEventListener("focus"');
    expect(hook).toContain('document.addEventListener("visibilitychange"');
    expect(hook).toContain("window.setInterval");
    expect(hook).toContain("window.clearInterval");
  });

  it("uses silent owner refreshes only for an awaiting customer handoff", () => {
    expect(ownerInbox).toContain("usePaymentHandoffRefresh");
    expect(ownerInbox).toContain('handoff.stage === "payment_pending"');
    expect(ownerInbox).toContain("load({ silent: true })");
    expect(ownerInbox).toContain("Completion never triggers a charge.");
  });
});
