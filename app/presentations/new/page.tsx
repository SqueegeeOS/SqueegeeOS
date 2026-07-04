import { redirect } from "next/navigation";
import { createPresentation } from "@/lib/presentations/repository";

export const dynamic = "force-dynamic";

export default async function NewPresentationPage() {
  const presentation = await createPresentation({ createdBy: "Team" });
  redirect(`/presentations/${presentation.id}/edit`);
}
