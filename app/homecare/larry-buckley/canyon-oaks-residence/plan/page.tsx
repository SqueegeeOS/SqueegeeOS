import type { Metadata } from "next";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { HomeCarePlanExperience } from "@/components/home-care-plan/experience";

export const metadata: Metadata = {
  title: `Your Home Care Plan — Larry Buckley | ${CUSTOMER_BRAND.name}`,
  description:
    "A personalized maintenance strategy created exclusively for the Canyon Oaks Residence.",
};

export default function CanyonOaksHomeCarePlanPage() {
  return <HomeCarePlanExperience />;
}
