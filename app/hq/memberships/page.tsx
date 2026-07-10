import type { Metadata } from "next";
import { HqMembershipsPage } from "@/components/admin/hq-memberships-page";

export const metadata: Metadata = {
  title: "Memberships · Headquarters",
  robots: { index: false, follow: false },
};

export default function MembershipsPage() {
  return <HqMembershipsPage />;
}
