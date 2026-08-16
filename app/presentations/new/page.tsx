import type { Metadata } from "next";
import { NewPresentationPage } from "@/components/presentations/new-presentation-page";
import { platformPageTitle } from "@/lib/brand/platform";
import { notFound } from "next/navigation";
import { loadSalesRepProfile } from "@/lib/sales/workspace-server";
import type { SalesRepProfile } from "@/lib/sales/rep-config";
import { requireNewPresentationPageActor } from "@/lib/sales/sales-access-dal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: platformPageTitle("New Presentation"),
  robots: { index: false, follow: false },
};

export default async function NewPresentationRoute({
  searchParams,
}: {
  searchParams: Promise<{
    rep?: string | string[];
    lead?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const repSlug = Array.isArray(query.rep) ? query.rep[0] : query.rep;
  const leadId = Array.isArray(query.lead) ? query.lead[0] : query.lead;
  const returnParams = new URLSearchParams();
  if (repSlug) returnParams.set("rep", repSlug);
  if (leadId) returnParams.set("lead", leadId);
  const returnTo = `/presentations/new${returnParams.size ? `?${returnParams.toString()}` : ""}`;
  await requireNewPresentationPageActor(repSlug ?? null, returnTo);
  let repProfile: SalesRepProfile | null = null;
  if (repSlug) {
    try {
      repProfile = await loadSalesRepProfile(repSlug);
    } catch {
      notFound();
    }
  }

  return (
    <NewPresentationPage
      createdBy={repProfile?.displayName ?? "Team"}
      backHref={repProfile?.workspacePath ?? "/presentations"}
      repSlug={repProfile?.slug ?? null}
      salesRepLeadId={leadId ?? null}
      preauthorized
    />
  );
}
