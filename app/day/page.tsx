import type { Metadata } from "next";
import { DayExperience } from "@/components/day/day-experience";

export const metadata: Metadata = {
  title: "The Day's Work · SqueegeeKing",
  description:
    "Scroll moves the sun. Window cleaning, pressure washing, solar panel care, and maintenance plans, powered by HomeAtlas.",
  openGraph: {
    title: "The Day's Work · SqueegeeKing",
    description:
      "A day at the house with SqueegeeKing, powered by HomeAtlas.",
    images: [{ url: "/day/morning.jpg", width: 1376, height: 768 }],
  },
};

export default function DayPage() {
  return <DayExperience />;
}
