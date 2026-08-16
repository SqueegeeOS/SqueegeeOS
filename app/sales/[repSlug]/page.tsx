import { SalesRepWorkspace } from "@/components/sales/sales-rep-workspace";
import { presentationCloseReference } from "@/lib/presentations/navigation";
import { requireSalesWorkspacePageActor } from "@/lib/sales/sales-access-dal";
import { salesWorkspacePath } from "@/lib/sales/sales-access-paths";

export const dynamic = "force-dynamic";

export default async function SalesRepFieldDeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ repSlug: string }>;
  searchParams: Promise<{ closedPresentation?: string | string[] }>;
}) {
  const [{ repSlug }, query] = await Promise.all([params, searchParams]);
  const actor = await requireSalesWorkspacePageActor(
    repSlug,
    salesWorkspacePath(repSlug),
  );
  return (
    <SalesRepWorkspace
      repSlug={repSlug}
      sessionKind={actor.kind}
      closedPresentationId={presentationCloseReference(
        query.closedPresentation,
      )}
    />
  );
}
