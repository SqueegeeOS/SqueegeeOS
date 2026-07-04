import type { Metadata } from "next";
import { CreateHomeCarePlanWizard } from "@/components/home-care-plan/create/create-home-care-plan-wizard";
import { platformPageTitle } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: platformPageTitle("Create Home Care Plan"),
  description: "Generate a personalized Home Care Plan for a homeowner.",
};

export default function EmployeeCreateHomeCarePlanPage() {
  return <CreateHomeCarePlanWizard />;
}
