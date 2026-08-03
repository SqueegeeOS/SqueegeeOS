import { SalesRepWorkspace } from "@/components/sales/sales-rep-workspace";

export const dynamic = "force-dynamic";

export default async function SalesRepFieldDeskPage({
  params,
}: {
  params: Promise<{ repSlug: string }>;
}) {
  const { repSlug } = await params;
  return <SalesRepWorkspace repSlug={repSlug} />;
}
