import type { Metadata } from "next";
import { CreateHomeCarePlanWizard } from "@/components/home-care-plan/create/create-home-care-plan-wizard";
import { platformPageTitle } from "@/lib/brand/platform";
import { requireHqPage } from "@/lib/auth/require-hq-page";

export const metadata: Metadata = {
  title: platformPageTitle("Create Home Care Plan"),
  description: "Generate a personalized Home Care Plan for a homeowner.",
};

export default async function EmployeeCreateHomeCarePlanPage() {
  await requireHqPage("/employee/home-care-plan/create");
  return <CreateHomeCarePlanWizard />;
}
