import type { Metadata } from "next";
import { CustomerWorkspacePageShell } from "@/components/admin/customer-workspace-page-shell";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: `Customer | ${PLATFORM_BRAND.name}`,
  robots: { index: false, follow: false },
};

export default async function HqCustomerWorkspaceRoute({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  return <CustomerWorkspacePageShell type={type} id={id} />;
}
