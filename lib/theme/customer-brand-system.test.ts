import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("shared homeowner brand boundary", () => {
  it("leaves operational root tokens unchanged and scopes the public palette", () => {
    const css = read("app/globals.css");
    const root = css.slice(css.indexOf(":root {"), css.indexOf("\n}", css.indexOf(":root {")));
    expect(root).toContain("--background: #070605;");
    expect(root).toContain("--foreground: #f5f2eb;");
    const scope = css.slice(css.indexOf(".customer-theme {"), css.indexOf("\n}", css.indexOf(".customer-theme {")));
    for (const token of ["--background: #f4efe4;", "--foreground: #173f32;", "--muted: #526b60;", "color-scheme: light;"]) {
      expect(scope).toContain(token);
    }
    expect(css).toContain(".customer-button-primary");
    expect(css).toContain(".customer-panel");
  });

  it("keeps mobile and tablet hero content in normal flow with real navigation", () => {
    const css = read("app/atlas-glass/atlas-glass.module.css");
    const responsive = css.slice(css.indexOf("/* The same calm, legible customer language"));
    expect(responsive).toContain("@media (max-width:1100px)");
    expect(responsive).toContain(".heroCopy { position: relative; top: auto; left: auto;");
    expect(responsive).toContain(".memoryDock { position: relative; inset: auto;");
    expect(responsive).toContain("grid-template-columns: repeat(2,minmax(0,1fr))");
    const home = read("app/atlas-glass/atlas-glass.tsx");
    expect(home).toContain("CustomerBrandLockup");
    expect(home).toContain('aria-label="Mobile navigation"');
    expect(home).toContain("example only");
    expect(home).not.toContain('href="#reviews"');
  });

  it("uses the same palette on the existing care plan without changing providers", () => {
    const plan = read("components/home-care-plan/experience.tsx");
    expect(plan).toContain('data-atlas-theme="night"');
    expect(plan).toContain("<MembershipCheckoutProvider planData={data}>");
    expect(plan).toContain("<MembershipUnlockProvider>");
  });
});
