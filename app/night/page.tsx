import type { Metadata } from "next";
import { NightExperience } from "@/components/night/night-experience";

export const metadata: Metadata = {
  title: "The Night Watch · HomeAtlas",
  description:
    "Every house sleeps. Yours is watched. Window cleaning, pressure washing, solar panel care, and maintenance plans with a memory.",
  openGraph: {
    title: "The Night Watch · HomeAtlas",
    description:
      "Every house sleeps. Yours is watched. Home care with a memory, by SqueegeeKing.",
    images: [{ url: "/night/house-lit.jpg", width: 1584, height: 672 }],
  },
};

export default function NightPage() {
  return <NightExperience />;
}
