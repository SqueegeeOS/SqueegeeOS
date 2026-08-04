import type { Metadata } from "next";
import { NewPresentationPage } from "@/components/presentations/new-presentation-page";
import { platformPageTitle } from "@/lib/brand/platform";
import { notFound } from "next/navigation";
import { loadSalesRepProfile } from "@/lib/sales/workspace-server";
import type { SalesRepProfile } from "@/lib/sales/rep-config";

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
    />
  );
}
