import type { Metadata } from "next";
import { CreateHomeCarePlanWizard } from "@/components/home-care-plan/create/create-home-care-plan-wizard";

export const metadata: Metadata = {
  title: "Create Home Care Plan | SqueegeeOS",
  description: "Generate a personalized Home Care Plan for a homeowner.",
};

export default function EmployeeCreateHomeCarePlanPage() {
  return <CreateHomeCarePlanWizard />;
}
