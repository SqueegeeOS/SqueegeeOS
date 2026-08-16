import { SalesRepWorkspace } from "@/components/sales/sales-rep-workspace";
import { presentationCloseReference } from "@/lib/presentations/navigation";
import { requireSalesWorkspacePageActor } from "@/lib/sales/sales-access-dal";

export const dynamic = "force-dynamic";

export default async function DavidFieldDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ closedPresentation?: string | string[] }>;
}) {
  const query = await searchParams;
  const actor = await requireSalesWorkspacePageActor("david", "/david");
  return (
    <SalesRepWorkspace
      repSlug="david"
      sessionKind={actor.kind}
      closedPresentationId={presentationCloseReference(
        query.closedPresentation,
      )}
    />
  );
}
