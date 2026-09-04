import { redirect } from "next/navigation";
import { requireFieldPageActor } from "@/lib/field-operations/field-access-dal";

export default async function TechnicianPropertiesPage() {
  await requireFieldPageActor("/tech/properties");
  // Property memory is opened from an exact assigned stop. There is no
  // technician-facing customer directory to browse.
  redirect("/tech");
}
