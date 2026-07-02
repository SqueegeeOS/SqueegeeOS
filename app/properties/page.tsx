import type { Metadata } from "next";
import { PropertyHub } from "@/components/property/hub/property-hub";

export const metadata: Metadata = {
  title: "Property Hub | SqueegeeOS",
  description:
    "The central hub for every property — scores, timelines, archives, and living digital history.",
};

export default function PropertiesPage() {
  return <PropertyHub />;
}
