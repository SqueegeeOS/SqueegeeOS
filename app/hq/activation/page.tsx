import type { Metadata } from "next";
import { AtlasPulsePage } from "@/components/admin/atlas-pulse-page";

export const metadata: Metadata = {
  title: "Atlas Pulse | Headquarters | SqueegeeKing",
  description:
    "Private activation control tower for customer journeys, integrations, Jobber pairing, and care opportunities.",
  robots: { index: false, follow: false },
};

export default function HqActivationPage() {
  return <AtlasPulsePage />;
}
