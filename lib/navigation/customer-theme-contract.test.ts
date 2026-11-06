import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("cohesive public quote experience", () => {
  it("keeps the light customer surface through request, fallback, receipt and contact", () => {
    const request = read("components/acquisition/request-form.tsx");
    expect(request.match(/customer-theme/g)).toHaveLength(3);
    expect(request.match(/Request a free quote\./g)).toHaveLength(2);
    expect(request).toContain("Request my free quote");
    expect(read("components/navigation/contact-page.tsx")).toContain("customer-theme");
  });

  it("welcomes one-time care without changing the optional membership payload", () => {
    const request = read("components/acquisition/request-form.tsx");
    expect(request).toContain("Membership interest (optional)");
    expect(request).toContain("Just need one visit, or not sure yet?");
    expect(request).toContain("value={form.membershipTier}");
    expect(request).toContain("onChange={setMembershipTier}");
    expect(request).toContain("...form,");
    expect(request).toContain("submissionId: submissionAttempt.id");
  });

  it("uses readable field labels and native-size inputs", () => {
    const request = read("components/acquisition/request-form.tsx");
    const labels = [...request.matchAll(/<(?:label|legend)\b[\s\S]*?className="([^"]+)"/g)];
    expect(labels.length).toBeGreaterThan(8);
    for (const label of labels) expect(label[1]).not.toMatch(/text-\[(?:9|10|11)px\]/);
    expect(request).toContain("text-base text-foreground placeholder:text-muted");
    expect(request).not.toContain("placeholder:text-muted/60");
  });

  it("reuses the brand and quote action across public desktop and mobile navigation", () => {
    const nav = read("components/navigation/customer-nav.tsx");
    expect(nav).toContain("CustomerBrandLockup");
    expect(nav).toContain('pathname === ROUTES.request');
    expect(nav).toContain('pathname === ROUTES.contact');
    expect(nav).toContain('pathname === "/privacy"');
    expect(nav).toContain('pathname === "/terms"');
    expect(nav).toContain('label: "Free quote"');
    expect(nav).toContain("[&_a]:min-h-11");
  });

  it("carries the public brand into the portalled mobile drawer without reskinning staff navigation", () => {
    const drawer = read("components/navigation/mobile-menu.tsx");
    expect(drawer).toContain('daylight ? "customer-theme border-border');
    expect(drawer).toContain("{daylight ? (");
    expect(drawer).toContain("<CustomerBrandLockup />");
    expect(drawer).toContain("{brandName}");
    expect(drawer).toContain("previousFocus?.isConnected");
    expect(drawer).toContain('event.key === "Escape"');
    expect(drawer).toContain('document.body.style.overflow = previousOverflow');
  });

  it("opts only the quote flow into the customer transition palette", () => {
    expect(read("components/acquisition/request-form.tsx")).toContain('appearance="customer"');
    const transition = read("components/experience/request-plan-transition.tsx");
    expect(transition).toContain('appearance = "default"');
    expect(transition).toContain('appearance === "customer" ? "customer-theme" : ""');
    expect(read("components/experience/request-transition-lab-player.tsx")).not.toContain('appearance="customer"');
  });

});
