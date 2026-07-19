import type { Metadata } from "next";
import { Day2Homepage } from "@/components/marketing/day2-homepage";
import { getGooglePlaceId } from "@/lib/reviews/config";

const BASE = "https://www.squeegeeking.net";

/** LocalBusiness structured data — real facts only; ratings arrive with the reviews connection. */
function buildJsonLd() {
  const placeId = getGooglePlaceId();
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${BASE}/#business`,
    name: "SqueegeeKing",
    url: BASE,
    image: `${BASE}/day/morning.jpg`,
    description:
      "Premium window cleaning, pressure washing, solar panel cleaning, and recurring home maintenance memberships. Every membership includes HomeAtlas, a living record of your home's care.",
    slogan: "Done the right way. When you join, you are family.",
    ...(placeId
      ? { sameAs: [`https://www.google.com/maps/place/?q=place_id:${placeId}`] }
      : {}),
    makesOffer: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Window Cleaning", serviceType: "Window cleaning" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Pressure Washing", serviceType: "Pressure washing" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Solar Panel Cleaning", serviceType: "Solar panel cleaning" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Home Maintenance Membership", serviceType: "Recurring exterior home care, every 3 or 6 months" } },
    ],
  };
}


export const metadata: Metadata = {
  title: "SqueegeeKing — Premium Home Care, Done The Right Way",
  alternates: { canonical: "/" },
  description:
    "Window cleaning, pressure washing, and solar panel care with a memory. Every membership includes HomeAtlas: a living record of your home's care. When you join, you are family.",
  openGraph: {
    title: "SqueegeeKing — The Right Way",
    description:
      "Premium home care with a memory. When you join, you are family.",
    images: [{ url: "/day/morning.jpg", width: 1376, height: 768 }],
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
      />
      <Day2Homepage />
    </>
  );
}
