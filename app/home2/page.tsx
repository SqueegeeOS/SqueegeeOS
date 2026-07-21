import type { Metadata } from "next";
import { Home2Homepage } from "@/components/marketing/home2-homepage";

export const metadata: Metadata = {
  title: "SqueegeeKing Membership — Home Care, Put on a Plan",
  description:
    "A recurring exterior home care membership built around your property, with care every 3 months or every 6 months as confirmed in your Home Care Plan.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function Home2Page() {
  return <Home2Homepage />;
}
