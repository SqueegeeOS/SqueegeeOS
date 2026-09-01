import type { Metadata } from "next";
import { OwnerDispatchPage } from "@/components/admin/owner-dispatch-page";

export const metadata: Metadata = {
  title: "Dispatch | HomeAtlas HQ",
  description: "Owner-only Jobber schedule, route map, and crew assignment command board.",
  robots: { index: false, follow: false },
};

export default function HqDispatchPage() {
  return <OwnerDispatchPage />;
}
