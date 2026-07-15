import { redirect } from "next/navigation";
import { createPresentation } from "@/lib/presentations/repository";
import { requireHqPage } from "@/lib/auth/require-hq-page";

export const dynamic = "force-dynamic";

export default async function NewPresentationPage() {
  const actor = await requireHqPage("/presentations/new");
  const presentation = await createPresentation({
    createdBy: actor.email,
    homeSqft: 0,
  });
  redirect(`/presentations/${presentation.id}/edit`);
}
