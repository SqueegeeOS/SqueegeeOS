import type { Metadata } from "next";
import { RightwayLab } from "@/components/marketing/rightway-lab";

export const metadata: Metadata = {
  title: "Rightway Lab — effect demos",
  robots: { index: false, follow: false },
};

export default function Lab() {
  return <RightwayLab />;
}
