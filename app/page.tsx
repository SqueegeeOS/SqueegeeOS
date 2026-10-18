import type { Metadata } from "next";
import { AtlasGlass } from "@/app/atlas-glass/atlas-glass";
import {
  buildLocalBusinessJsonLd,
  serializeJsonLd,
} from "@/lib/marketing/local-seo";

export const metadata: Metadata = {
  title: {
    absolute: "Window Cleaning & Exterior Home Care in Chico, CA | SqueegeeKing",
  },
  alternates: { canonical: "/" },
  description:
    "Window cleaning, gutter cleaning, pressure washing, and solar panel cleaning in Chico, CA. Request a free quote for one-time or recurring SqueegeeKing care.",
  openGraph: {
    title: "Window Cleaning & Exterior Home Care in Chico, CA | SqueegeeKing",
    description:
      "Windows, gutters, pressure washing, and solar panel cleaning in Chico. Get a free quote for one-time or recurring care.",
    url: "/",
    type: "website",
    images: [
      {
        url: "/atlas-glass/hero-house-wide.png",
        width: 1672,
        height: 941,
        alt: "A cared-for Chico home connected to its HomeAtlas care record",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Window Cleaning & Exterior Home Care in Chico, CA | SqueegeeKing",
    description:
      "Windows, gutters, pressure washing, and solar panel cleaning in Chico. Get a free quote for one-time or recurring care.",
    images: ["/atlas-glass/hero-house-wide.png"],
  },
};

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
