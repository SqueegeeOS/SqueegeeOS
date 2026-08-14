import type { Metadata } from "next";
import { AtlasGlass } from "./atlas-glass";

export const metadata: Metadata = {
  title: "HomeAtlas — Your Home Remembers",
  description:
    "An interactive SqueegeeKing homepage concept showing how HomeAtlas remembers every visit, photo, and promise.",
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },
};

export default function AtlasGlassPage() {
  return <AtlasGlass />;
}
