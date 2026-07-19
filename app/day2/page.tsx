import type { Metadata } from "next";
import { Day2Homepage } from "@/components/marketing/day2-homepage";

export const metadata: Metadata = {
  title: "SqueegeeKing — The Right Way",
  description:
    "Window cleaning, pressure washing, and solar panel care with a memory. Every membership includes HomeAtlas: a living record of your home's care. When you join, you are family.",
  robots: { index: false, follow: false },
};

export default function Day2Page() {
  return <Day2Homepage />;
}
