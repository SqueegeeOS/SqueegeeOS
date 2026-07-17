import type { Metadata } from "next";
import { StarryHomepage } from "@/components/marketing/starry-homepage";

export const metadata: Metadata = {
  title: "SqueegeeKing — Premium Home Care, Done The Right Way",
  description:
    "Window cleaning, pressure washing, and solar panel care with a memory. Every membership includes HomeAtlas: a living record of your home's care. When you join, you are family.",
  openGraph: {
    title: "SqueegeeKing — The Right Way",
    description:
      "Premium home care with a memory. When you join, you are family.",
    images: [{ url: "/home/family-twilight.jpg", width: 1584, height: 672 }],
  },
};

export default function HomePage() {
  return <StarryHomepage />;
}
