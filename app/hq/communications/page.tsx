import type { Metadata } from "next";
import { CommunicationsInboxPage } from "@/components/admin/communications-inbox-page";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: `Inbox | Headquarters | SqueegeeKing`,
  description: `Private customer email and text conversations for ${PLATFORM_BRAND.name}.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function HqCommunicationsPage() {
  return <CommunicationsInboxPage />;
}
