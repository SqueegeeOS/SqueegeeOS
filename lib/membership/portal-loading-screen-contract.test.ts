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
  const hqLayout = read("app/hq/layout.tsx");
  const portalLayout = read("app/portal/layout.tsx");
  const preloader = read(
    "components/portal/preload-portal-loading-artwork.tsx",
  );
  const nextConfig = read("next.config.ts");

  it("uses the supplied HomeAtlas artwork and native animated mark", () => {
    expect(loader).toContain("/brand/homeatlas-member-loader-v1.webp");
    expect(loader).toContain("ARTWORK_BLUR_DATA_URL");
    expect(loader).toContain('placeholder="blur"');
    expect(loader).toContain("AtlasMark");
    expect(loader).toContain("Preparing your HomeAtlas portal");
  });

  it("renders its progress animation without waiting for client hydration", () => {
    expect(loader).not.toContain('"use client"');
    expect(loader).not.toContain("useEffect");
    expect(loader).toContain("portal-loading-dot-pending");
    expect(loader).toContain(
      'animationDelay: index === 1 ? "650ms" : "1500ms"',
    );
  });

  it("blends the animated Atlas mark into the artwork without a hard disc", () => {
    expect(loader).toContain("bg-[radial-gradient(circle");
    expect(loader).not.toContain("rounded-full bg-[#0a0b08]/75");
    expect(loader).not.toContain("backdrop-blur-[2px]");
  });

  it("preloads one publicly cacheable artwork asset before member navigation", () => {
    expect(preloader).toContain("ReactDOM.preload");
    expect(preloader).toContain("/brand/homeatlas-member-loader-v1.webp");
    expect(hqLayout).toContain("<PreloadPortalLoadingArtwork />");
    expect(portalLayout).toContain("<PreloadPortalLoadingArtwork />");
    expect(nextConfig).toContain("public, max-age=31536000, immutable");
    expect(nextConfig).not.toContain(
      'source: "/portal/atlas-loading-screen.webp"',
    );
  });

  it("covers private token, legacy slug, PWA entry, and welcome redirects", () => {
    expect(tokenLoading).toContain("PortalLoadingScreen");
    expect(slugLoading).toContain("PortalLoadingScreen");
    expect(portalEntry).toContain("<PortalLoadingScreen />");
    expect(welcome).toContain("<PortalLoadingScreen />");
  });
});
