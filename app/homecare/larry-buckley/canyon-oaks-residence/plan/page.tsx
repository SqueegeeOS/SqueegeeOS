import type { Metadata } from "next";
import { HomeCarePlanExperience } from "@/components/home-care-plan/experience";

export const metadata: Metadata = {
  title: "Your Personalized Home Care Plan — Larry Buckley | Squeegeeking",
  description:
    "A personalized maintenance strategy created exclusively for the Canyon Oaks Residence.",
};

export default function CanyonOaksHomeCarePlanPage() {
  return <HomeCarePlanExperience />;
}
