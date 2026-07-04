import type { Metadata } from "next";
import { WorkInProgressPage } from "@/components/ui/work-in-progress";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";

export const metadata: Metadata = {
  title: `Home Care Experience | ${CUSTOMER_BRAND.name}`,
  description: "Personalized home care presentations are created after your property inspection.",
};

export default function LarryBuckleyPage() {
  return (
    <WorkInProgressPage
      title="Your plan lives here after inspection."
      description="We removed the demo homeowner experience. When your team generates a real Home Care Plan, it will appear at a private link for that property — not a sample profile."
      primaryHref="/request"
      primaryLabel="Request your Home Care Plan"
      secondaryHref="/"
      secondaryLabel="Back to home"
    />
  );
}
