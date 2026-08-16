import type { Metadata } from "next";
import { OwnerSalesInboxPage } from "@/components/admin/owner-sales-inbox-page";

export const metadata: Metadata = {
  title: "Sales Inbox · Headquarters",
  description: "Private owner handoff and field sales action queue.",
  robots: { index: false, follow: false },
};

export default function HqSalesPage() {
  return <OwnerSalesInboxPage />;
}
