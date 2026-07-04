import type { Metadata } from "next";
import { WorkInProgressPage } from "@/components/ui/work-in-progress";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";

export const metadata: Metadata = {
  title: `Home Care Plan | ${CUSTOMER_BRAND.name}`,
  description: "Personalized home care plans are delivered after your property inspection.",
};

export default function CanyonOaksHomeCarePlanPage() {
  return (
    <WorkInProgressPage
      title="Sample plans are retired."
      description="This demo presentation has been removed. Your real Home Care Plan will be shared with you privately after inspection — with pricing and recommendations specific to your home."
      primaryHref="/request"
      primaryLabel="Start with a request"
      secondaryHref="/"
      secondaryLabel="Back to home"
    />
  );
}
