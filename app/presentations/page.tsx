import type { Metadata } from "next";
import { PresentationListPage } from "@/components/presentations/presentation-list-page";
import { platformPageTitle } from "@/lib/brand/platform";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: platformPageTitle("Presentations"),
  robots: { index: false, follow: false },
};

export default function PresentationsPage() {
  return <PresentationListPage />;
}
