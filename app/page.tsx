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
    "Professional window cleaning, pressure washing, solar panel cleaning, and recurring exterior home care for Chico, California homeowners.",
  openGraph: {
    title: "Window Cleaning & Exterior Home Care in Chico, CA | SqueegeeKing",
    description:
      "Professional exterior home care in Chico with a personalized plan and a memory for every membership.",
    url: "/",
    type: "website",
    images: [
      {
        url: "/atlas-glass/hero-house.jpg",
        width: 1376,
        height: 768,
        alt: "A cared-for Chico home connected to its HomeAtlas care record",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Window Cleaning & Exterior Home Care in Chico, CA | SqueegeeKing",
    description:
      "Professional window cleaning and exterior home care in Chico, powered by a HomeAtlas record for every member home.",
    images: ["/atlas-glass/hero-house.jpg"],
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
