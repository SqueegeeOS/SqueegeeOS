import type { Metadata } from "next";
import { NewPresentationPage } from "@/components/presentations/new-presentation-page";
import { platformPageTitle } from "@/lib/brand/platform";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: platformPageTitle("New Presentation"),
  robots: { index: false, follow: false },
};

export default function NewPresentationRoute() {
  return <NewPresentationPage />;
}
