import { pwaConfig } from "./config";

const ICONS = [
  { src: "/icons/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
  { src: "/icons/icon-512x512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
  { src: "/icons/icon-maskable-512x512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
];

/** One manifest shape everywhere; start_url/id vary per member surface. */
export function buildPortalManifest(startUrl: string) {
  return {
    id: startUrl,
    name: pwaConfig.name,
    short_name: pwaConfig.shortName,
    description: pwaConfig.description,
    start_url: startUrl,
    scope: pwaConfig.scope,
    display: pwaConfig.display,
    background_color: pwaConfig.backgroundColor,
    theme_color: pwaConfig.themeColor,
    orientation: "portrait",
    icons: ICONS,
  };
}

export function genericPortalManifest() {
  return buildPortalManifest(pwaConfig.startUrl);
}
