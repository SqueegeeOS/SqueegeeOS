import { SalesRepWorkspace } from "@/components/sales/sales-rep-workspace";
import { requireSalesWorkspacePageActor } from "@/lib/sales/sales-access-dal";
import { salesWorkspacePath } from "@/lib/sales/sales-access-paths";

export const dynamic = "force-dynamic";

export default async function SalesRepFieldDeskPage({
  params,
}: {
  params: Promise<{ repSlug: string }>;
}) {
  const { repSlug } = await params;
  const actor = await requireSalesWorkspacePageActor(
    repSlug,
    salesWorkspacePath(repSlug),
  );
  return <SalesRepWorkspace repSlug={repSlug} sessionKind={actor.kind} />;
}
