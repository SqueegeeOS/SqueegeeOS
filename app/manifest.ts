import type { MetadataRoute } from "next";
import { pwaConfig } from "@/lib/pwa/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: pwaConfig.name,
    short_name: pwaConfig.shortName,
    description: pwaConfig.description,
    start_url: pwaConfig.startUrl,
    display: pwaConfig.display,
    background_color: pwaConfig.backgroundColor,
    theme_color: pwaConfig.themeColor,
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192x192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512x512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
