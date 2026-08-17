import type { Metadata } from "next";
import { AtlasOperatorPage } from "@/components/admin/atlas-operator-page";

export const metadata: Metadata = {
  title: "Atlas | Headquarters | SqueegeeKing",
  description: "Private operating intelligence for HomeAtlas Headquarters.",
  robots: { index: false, follow: false, nocache: true },
};

export default function HqAtlasPage() {
  return <AtlasOperatorPage />;
}
