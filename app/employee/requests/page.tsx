import type { Metadata } from "next";
import { EmployeePlaceholderPage } from "@/components/navigation/employee-placeholder-page";
import { ROUTES } from "@/lib/navigation/config";

export const metadata: Metadata = {
  title: "Requests | SqueegeeOS",
  description: "Incoming homeowner requests and plan inquiries.",
};

export default function EmployeeRequestsPage() {
  return (
    <EmployeePlaceholderPage
      eyebrow="Requests"
      title="Incoming requests"
      description="Homeowner inquiries and plan requests will appear here as the platform grows. For now, new leads arrive through the public request form."
      actionHref={ROUTES.request}
      actionLabel="View request form"
    />
  );
}
