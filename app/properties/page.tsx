import type { Metadata } from "next";
import { EmployeePlaceholderPage } from "@/components/navigation/employee-placeholder-page";
import { ROUTES } from "@/lib/navigation/config";
import { platformPageTitle } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: platformPageTitle("Property Hub"),
  description:
    "Property archives and timelines — available when your team connects live property data.",
};

export default function PropertiesPage() {
  return (
    <EmployeePlaceholderPage
      eyebrow="Property Hub"
      title="Property archives are on the way"
      description="The Property Hub will list real homes from your database — scores, timelines, and visit history. Demo properties have been removed so nothing here pretends to be live data."
      actionHref={ROUTES.employeeHome}
      actionLabel="Back to dashboard"
    />
  );
}
