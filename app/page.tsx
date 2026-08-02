import type { Metadata } from "next";
import { Day2Homepage } from "@/components/marketing/day2-homepage";
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
        url: "/day/morning.jpg",
        width: 1376,
        height: 768,
        alt: "A cared-for Chico home in warm morning light",
      },
    ],
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
      <Day2Homepage />
    </>
  );
}
