import type { Metadata } from "next";
import { OurStoryPage } from "@/components/admin/our-story-page";

export const metadata: Metadata = {
  title: "Our Story | SqueegeeKing",
  description: "The living memory of SqueegeeKing — for founders only.",
  robots: { index: false, follow: false },
};

export default function AdminOurStoryRoute() {
  return <OurStoryPage />;
}
