import { SalesRepWorkspace } from "@/components/sales/sales-rep-workspace";
import { requireSalesWorkspacePageActor } from "@/lib/sales/sales-access-dal";

export const dynamic = "force-dynamic";

export default async function DavidFieldDeskPage() {
  const actor = await requireSalesWorkspacePageActor("david", "/david");
  return <SalesRepWorkspace repSlug="david" sessionKind={actor.kind} />;
}
