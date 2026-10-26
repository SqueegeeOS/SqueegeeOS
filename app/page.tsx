import type { Metadata } from "next";
import { buildPublicPageMetadata } from "@/lib/marketing/page-metadata";
import { AtlasGlass } from "@/app/atlas-glass/atlas-glass";
import {
  buildLocalBusinessJsonLd,
  serializeJsonLd,
} from "@/lib/marketing/local-seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Window Cleaning & Exterior Home Care in Chico, CA",
  description:
    "Window cleaning, gutter cleaning, pressure washing, and solar panel cleaning in Chico, CA. Get a free quote for one-time or recurring home care.",
  path: "/",
  image: {
    url: "/atlas-glass/hero-house-wide.png",
    width: 1672,
    height: 941,
    alt: "A cared-for home illustrated with its HomeAtlas care record",
  },
});

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildLocalBusinessJsonLd()),
        }}
      />
      <AtlasGlass />
    </>
  );
}
