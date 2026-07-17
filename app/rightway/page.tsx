import type { Metadata } from "next";
import { StarryHomepage } from "@/components/marketing/starry-homepage";

export const metadata: Metadata = {
  title: "The Right Way · SqueegeeKing",
  description:
    "Window, pressure washing, and solar care, done like we'd do it for our own family. Membership, benefits, and HomeAtlas: the memory of your home.",
  openGraph: {
    title: "The Right Way · SqueegeeKing",
    description: "When you join, you are family.",
    images: [{ url: "/home/family-twilight.jpg", width: 1584, height: 672 }],
  },
};

export default function RightWayPage() {
  return <StarryHomepage />;
}
