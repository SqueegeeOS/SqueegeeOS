"use client";

import { ReviewsSection } from "@/components/reviews/reviews-section";
import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";

export function Reviews({ data }: { data: HomeCarePlanData }) {
  return <ReviewsSection data={data.reviews} />;
}
