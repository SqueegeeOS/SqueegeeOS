import type { Metadata } from "next";
import { NewPresentationPage } from "@/components/presentations/new-presentation-page";
import { platformPageTitle } from "@/lib/brand/platform";
import { profileForKnownRep } from "@/lib/sales/rep-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: platformPageTitle("New Presentation"),
  robots: { index: false, follow: false },
};

export default async function NewPresentationRoute({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string | string[] }>;
}) {
  const query = await searchParams;
  const repSlug = Array.isArray(query.rep) ? query.rep[0] : query.rep;
  const repProfile = repSlug ? profileForKnownRep(repSlug) : null;

  return (
    <NewPresentationPage
      createdBy={repProfile?.displayName ?? "Team"}
      backHref={repProfile?.workspacePath ?? "/presentations"}
    />
  );
}
