import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("member portal loading screen contract", () => {
  const loader = read("components/portal/portal-loading-screen.tsx");
  const tokenLoading = read("app/portal/[token]/loading.tsx");
  const slugLoading = read(
    "app/homecare/[homeownerSlug]/[propertySlug]/portal/loading.tsx",
  );
  const portalEntry = read("app/portal/page.tsx");
  const welcome = read("components/pwa/PortalWelcomeHome.tsx");

  it("uses the supplied HomeAtlas artwork and native animated mark", () => {
    expect(loader).toContain("/portal/atlas-loading-screen.webp");
    expect(loader).toContain("AtlasMark");
    expect(loader).toContain("Preparing your HomeAtlas portal");
  });

  it("advances three dots only while the real portal suspense is pending", () => {
    expect(loader).toContain("PROGRESS_DELAYS");
    expect(loader).toContain("step >= index + 1");
    expect(loader).toContain("step ${step} of 3");
  });

  it("covers private token, legacy slug, PWA entry, and welcome redirects", () => {
    expect(tokenLoading).toContain("PortalLoadingScreen");
    expect(slugLoading).toContain("PortalLoadingScreen");
    expect(portalEntry).toContain("<PortalLoadingScreen />");
    expect(welcome).toContain("<PortalLoadingScreen />");
  });
});
